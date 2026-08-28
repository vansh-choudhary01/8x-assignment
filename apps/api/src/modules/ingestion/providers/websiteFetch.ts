import * as cheerio from "cheerio";
import { config } from "../../../config.ts";
import type { WebsiteIngestResult, WebsitePage, WebsiteSourceProvider } from "./types.ts";

const SKIP_EXT = /\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|mp4|mp3|css|js|woff2?)(\?|$)/i;
const MAX_PAGES = 8;
const MIN_BODY = 80;
const MIN_WITH_META = 40;
const FETCH_MS = 20_000;

const DEFAULT_UA =
  "Mozilla/5.0 (compatible; NaanoBot/0.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function userAgent(): string {
  const configured = config.ingestUserAgent;
  if (configured && !/^NaanoBot\/0\.1 \(assignment/i.test(configured)) {
    return configured;
  }
  return DEFAULT_UA;
}

function hostKey(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function sameSite(a: URL, b: URL): boolean {
  return hostKey(a.hostname) === hostKey(b.hostname);
}

function normalizeUrl(raw: string): string {
  const parsed = new URL(raw);
  parsed.hash = "";
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

function jsonLdStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length >= 12) out.push(trimmed);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) jsonLdStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (key.startsWith("@")) continue;
      jsonLdStrings(nested, out);
    }
  }
  return out;
}

function extractContent(html: string): { title?: string; text: string; spaShell: boolean } {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().replace(/\s+/g, " ").trim() ||
    undefined;
  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim();
  const keywords = $('meta[name="keywords"]').attr("content")?.trim();

  const jsonLd: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      jsonLdStrings(JSON.parse(raw), jsonLd);
    } catch {
      /* ignore invalid json-ld */
    }
  });

  const hadModuleScripts = $('script[type="module"], script[src]').length > 0;
  const root = $("#root, #app, #__next").first();
  const emptyRoot = root.length > 0 && root.text().replace(/\s+/g, "").length < 20;

  $("script, style, noscript, iframe, svg, template").remove();

  const main = $("main, article, [role=main]").first();
  const mainText = main.length ? main.text().replace(/\s+/g, " ").trim() : "";
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const visible = (mainText.length >= 40 ? mainText : bodyText).slice(0, 24_000);

  const spaShell = emptyRoot && hadModuleScripts && visible.length < MIN_BODY;

  const parts = [title, description, keywords, ...jsonLd, visible].filter(Boolean) as string[];
  const text = parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 24_000);

  return { title, text, spaShell };
}

function isHtmlContentType(contentType: string, body: string): boolean {
  const type = contentType.toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  if (!type || type === "application/octet-stream") {
    return /^\s*</.test(body);
  }
  return false;
}

type Fetched =
  | {
      ok: true;
      requestedUrl: string;
      finalUrl: string;
      status: number;
      contentType: string;
      body: string;
    }
  | {
      ok: false;
      requestedUrl: string;
      status?: number;
      reason: string;
    };

async function fetchUrl(url: string, accept: string): Promise<Fetched> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": userAgent(),
        Accept: accept,
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();
    return {
      ok: true,
      requestedUrl: url,
      finalUrl: response.url || url,
      status: response.status,
      contentType,
      body,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { ok: false, requestedUrl: url, reason: message };
  }
}

function pageFromHtml(url: string, status: number, html: string): WebsitePage {
  const { title, text } = extractContent(html);
  return { url, httpStatus: status, title, text, html };
}

function sameOriginLinks(html: string, base: URL): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const next = new URL(href, base);
      if (!sameSite(next, base)) return;
      if (SKIP_EXT.test(next.pathname)) return;
      found.add(normalizeUrl(next.toString()));
    } catch {
      /* ignore */
    }
  });
  return [...found].sort((a, b) => {
    const score = (url: string) => {
      const path = new URL(url).pathname.toLowerCase();
      if (/about|product|platform|solution|company|service|what/.test(path)) return 0;
      if (path === "/" || path === "") return 1;
      return 2;
    };
    return score(a) - score(b);
  });
}

async function sitemapLocs(origin: URL, notes: string[]): Promise<string[]> {
  const robots = await fetchUrl(new URL("/robots.txt", origin).toString(), "text/plain, */*;q=0.1");
  const sitemapUrls = new Set<string>([new URL("/sitemap.xml", origin).toString()]);
  if (robots.ok && robots.status < 400 && /sitemap\s*:/i.test(robots.body)) {
    for (const match of robots.body.matchAll(/sitemap:\s*(\S+)/gi)) {
      sitemapUrls.add(match[1]);
    }
  }

  const locs: string[] = [];
  for (const sitemapUrl of sitemapUrls) {
    const fetched = await fetchUrl(sitemapUrl, "application/xml, text/xml, */*;q=0.1");
    if (!fetched.ok) continue;
    if (fetched.status >= 400) continue;
    if (isHtmlContentType(fetched.contentType, fetched.body) && !fetched.body.includes("<urlset")) {
      continue;
    }
    const $ = cheerio.load(fetched.body);
    const locMatches = [...fetched.body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) =>
      m[1].trim(),
    );
    const locFromDom: string[] = [];
    $("loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) locFromDom.push(loc);
    });
    for (const loc of [...locFromDom, ...locMatches]) {
      try {
        const parsed = new URL(loc);
        if (sameSite(parsed, origin) && !SKIP_EXT.test(parsed.pathname)) {
          locs.push(normalizeUrl(parsed.toString()));
        }
      } catch {
        /* ignore */
      }
    }
  }
  const unique = [...new Set(locs)];
  if (unique.length) {
    notes.push(`Sitemap listed ${unique.length} same-site URL(s).`);
  }
  return unique;
}

function useful(page: WebsitePage): boolean {
  const hasMeta = Boolean(page.title);
  return page.httpStatus < 400 && page.text.length >= (hasMeta ? MIN_WITH_META : MIN_BODY);
}

export class WebsiteFetchProvider implements WebsiteSourceProvider {
  async ingest(url: string): Promise<WebsiteIngestResult> {
    const notes: string[] = [];
    let start: URL;
    try {
      start = new URL(url);
    } catch {
      return { pages: [], notes: [`"${url}" is not a valid URL.`] };
    }

    const home = await fetchUrl(start.toString(), "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1");
    if (!home.ok) {
      return {
        pages: [],
        notes: [`Could not fetch ${start.toString()}: ${home.reason}`],
      };
    }

    notes.push(`Fetched ${home.finalUrl} (HTTP ${home.status}, ${home.contentType || "no content-type"}).`);

    if (home.status >= 400) {
      return {
        pages: [],
        notes: [
          ...notes,
          `The host returned HTTP ${home.status}. The site may be blocking automated fetches or the URL may be wrong.`,
        ],
      };
    }

    if (!isHtmlContentType(home.contentType, home.body)) {
      return {
        pages: [],
        notes: [
          ...notes,
          `Expected HTML but got content-type "${home.contentType || "unknown"}".`,
        ],
      };
    }

    const finalBase = new URL(home.finalUrl);
    if (finalBase.origin !== start.origin) {
      notes.push(`Followed redirect ${start.toString()} → ${home.finalUrl}.`);
    }

    const first = pageFromHtml(normalizeUrl(home.finalUrl), home.status, home.body);
    const extracted = extractContent(home.body);
    if (extracted.spaShell) {
      notes.push(
        "The HTML is a JavaScript app shell (empty root, little server-rendered body). Using title, meta description, and any JSON-LD from the document, then discovering more URLs via links and sitemap.",
      );
    }
    if (extracted.text.length < MIN_WITH_META) {
      notes.push(
        `Extracted only ${extracted.text.length} character(s) of readable text from the homepage.`,
      );
    }

    const candidates = new Set<string>([first.url]);
    for (const href of sameOriginLinks(home.body, finalBase)) {
      candidates.add(href);
    }
    for (const loc of await sitemapLocs(finalBase, notes)) {
      candidates.add(loc);
    }

    const ordered = [
      first.url,
      ...[...candidates].filter((item) => item !== first.url),
    ].slice(0, MAX_PAGES);

    const pages: WebsitePage[] = [];
    const seenText = new Set<string>();

    for (const href of ordered) {
      try {
        const page =
          href === first.url
            ? first
            : await (async () => {
                const fetched = await fetchUrl(href, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1");
                if (!fetched.ok) {
                  notes.push(`Skipped ${href}: ${fetched.reason}`);
                  return null;
                }
                if (fetched.status >= 400 || !isHtmlContentType(fetched.contentType, fetched.body)) {
                  notes.push(`Skipped ${href}: HTTP ${fetched.status} ${fetched.contentType}`.trim());
                  return null;
                }
                return pageFromHtml(normalizeUrl(fetched.finalUrl), fetched.status, fetched.body);
              })();
        if (!page || !useful(page)) continue;
        const fingerprint = page.text.slice(0, 280);
        if (seenText.has(fingerprint)) {
          continue;
        }
        seenText.add(fingerprint);
        const { html: _html, ...stored } = page;
        pages.push(stored);
      } catch (err) {
        notes.push(
          `Skipped ${href}: ${err instanceof Error ? err.message : "fetch failed"}`,
        );
      }
    }

    if (pages.length === 0) {
      notes.push(
        "No page had enough public text (body copy, Open Graph/meta tags, or JSON-LD) after fetch and parse.",
      );
    } else {
      notes.push(`Stored ${pages.length} distinct page(s) with readable public text.`);
    }

    return { pages, notes };
  }
}
