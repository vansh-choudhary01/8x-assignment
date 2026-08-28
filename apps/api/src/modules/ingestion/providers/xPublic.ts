import * as cheerio from "cheerio";
import { config } from "../../../config.ts";
import {
  emptyPublicFields,
  type ProfileIngestResult,
  type ProfileSourceProvider,
} from "./types.ts";

const X_HOST = /(^|\.)(x\.com|twitter\.com)$/i;
const FETCH_MS = 18_000;
const RESERVED = new Set([
  "home",
  "explore",
  "search",
  "settings",
  "i",
  "intent",
  "compose",
  "login",
  "signup",
  "tos",
  "privacy",
  "notifications",
  "messages",
  "jobs",
  "about",
  "download",
  "hashtag",
]);

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function userAgent(): string {
  const configured = config.ingestUserAgent;
  if (configured && !/^NaanoBot\//i.test(configured)) return configured;
  return BROWSER_UA;
}

export function classifyXPublicUrl(raw: string): { url: string; handle: string } {
  const parsed = new URL(raw);
  if (!X_HOST.test(parsed.hostname)) {
    throw new Error("Not an X/Twitter URL");
  }
  const parts = parsed.pathname.split("/").filter(Boolean);
  const handle = parts[0]?.replace(/^@/, "");
  if (!handle || RESERVED.has(handle.toLowerCase()) || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    throw new Error("Use a public X profile URL (x.com/username)");
  }
  return { url: `https://x.com/${handle}`, handle };
}

function meta($: cheerio.CheerioAPI, ...selectors: string[]): string {
  for (const selector of selectors) {
    const value = $(selector).attr("content")?.trim();
    if (value) return decode(value);
  }
  return "";
}

function decode(value: string): string {
  return cheerio.load(`<textarea>${value}</textarea>`)("textarea").text().trim();
}

function parseCount(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) {
    const asInt = Number(cleaned);
    return Number.isFinite(asInt) ? asInt : undefined;
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "K") return Math.round(value * 1_000);
  if (suffix === "M") return Math.round(value * 1_000_000);
  if (suffix === "B") return Math.round(value * 1_000_000_000);
  return value;
}

function isSeoFiller(text: string): boolean {
  return /followers?\s*·/i.test(text) || /see the latest conversations with @/i.test(text);
}

function itemStats($: cheerio.CheerioAPI): { followers?: number; tweets?: number } {
  let followers: number | undefined;
  let tweets: number | undefined;
  $("[itemprop='userInteractionCount'], [itemProp='userInteractionCount']").each((_, el) => {
    const node = $(el);
    const count = Number(node.attr("content") ?? node.text());
    if (!Number.isFinite(count)) return;
    const name = node.closest("[itemprop='interactionStatistic'], [itemprop='agentInteractionStatistic']")
      .find("[itemprop='name'], [itemProp='name']")
      .attr("content") || node.parent().find("[itemprop='name'], [itemProp='name']").attr("content") || "";
    if (/^follows$/i.test(name)) followers = count;
    if (/^tweets$/i.test(name)) tweets = count;
  });
  return { followers, tweets };
}

function extractPosts($: cheerio.CheerioAPI, visible: string, handle: string, name: string): string[] {
  const fromMarkup: string[] = [];
  $("[itemprop='text'], [itemProp='text']").each((_, el) => {
    const content = $(el).attr("content")?.trim() || $(el).text().replace(/\s+/g, " ").trim();
    if (content && content.length >= 2 && content.length <= 400) fromMarkup.push(content);
  });
  if (fromMarkup.length) return uniqueKeep(fromMarkup).slice(0, 8);

  const marker = `@${handle}`;
  const parts = visible.split(marker).slice(1);
  const posts: string[] = [];
  for (const part of parts) {
    const cleaned = part
      .replace(/^(Pinned\s+)?/i, "")
      .replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s*\d{4})?\s*/i, "")
      .replace(/^\d+[smhd]\s+/i, "")
      .replace(/\s+\d[\d,.]*[KMB]?\s+\d[\d,.]*[KMB]?\s+\d[\d,.]*[KMB]?\s+\d[\d,.]*[KMB]?\s*$/i, "")
      .replace(/\s+Log in or sign up[\s\S]*$/i, "")
      .replace(/\s+©\s+\d{4}[\s\S]*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length < 2 || cleaned.length > 400) continue;
    if (new RegExp(`^${name}\\s*$`, "i").test(cleaned)) continue;
    if (/^(Posts|Replies|Media|Mention|Follow)$/i.test(cleaned)) continue;
    if (/log in or sign up|continue with (google|apple|phone)|x corp|postsreplies|followersmention/i.test(cleaned)) {
      continue;
    }
    posts.push(cleaned);
    if (posts.length >= 8) break;
  }
  return posts;
}

function uniqueKeep(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function extractLocation(visible: string, handle: string, about: string): string | undefined {
  const match = visible.match(new RegExp(`@${handle}\\s+(.+?)\\s+Joined\\s+`, "i"));
  if (!match) return undefined;
  let rest = match[1].replace(new RegExp(about.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim();
  rest = rest.replace(/^https?:\/\/\S+\s*/i, "").trim();
  if (!rest || rest.length > 80) return undefined;
  if (/following|followers|posts/i.test(rest)) return undefined;
  return rest;
}

export function extractXPublic(html: string, pageUrl: string, httpStatus: number, handle: string): ProfileIngestResult {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const ogTitle = meta($, 'meta[property="og:title"]') || $("title").first().text().trim();
  const ogDescription = meta($, 'meta[property="og:description"]', 'meta[name="description"]');
  const ogImage = meta($, 'meta[property="og:image"]');
  const titleMatch = ogTitle.match(/^(.*?)\s*\(@([^)]+)\)/);
  const name = titleMatch?.[1]?.trim() || $('meta[itemprop="name"][content]').last().attr("content")?.trim();
  const username = titleMatch?.[2]?.trim() || handle;

  const stats = itemStats($);
  const visible = $("body").text().replace(/\s+/g, " ").trim();
  let followerCount = stats.followers;
  if (followerCount == null) {
    const labeled = visible.match(/([\d,.]+(?:\.\d+)?[KMB]?)\s+Followers/i);
    if (labeled) followerCount = parseCount(labeled[1]);
  }
  const aboutRaw = ogDescription && !isSeoFiller(ogDescription) ? ogDescription : "";
  const website = aboutRaw.match(/https?:\/\/\S+/i)?.[0]?.replace(/[.,;]+$/, "");
  const about = website && aboutRaw === website ? undefined : aboutRaw || undefined;

  const location = extractLocation(visible, username, about ?? "");
  const posts = name ? extractPosts($, visible, username, name) : [];

  const followerCountRaw =
    typeof followerCount === "number" ? `X: ${followerCount.toLocaleString("en-US")}` : undefined;

  const fields = {
    ...emptyPublicFields(),
    name,
    username,
    about,
    website,
    location,
    followerCount,
    followerCountRaw,
    articleTitles: posts,
    topics: posts
      .flatMap((post) => post.match(/#([A-Za-z0-9_]+)/g) ?? [])
      .map((tag) => tag.slice(1)),
  };

  const found: string[] = [];
  const missing: string[] = [];
  const tracked = {
    name: Boolean(fields.name),
    username: Boolean(fields.username),
    about: Boolean(fields.about),
    location: Boolean(fields.location),
    website: Boolean(fields.website),
    followerCount: typeof fields.followerCount === "number",
    image: Boolean(ogImage),
    posts: posts.length > 0,
  };
  for (const [key, present] of Object.entries(tracked)) {
    (present ? found : missing).push(key);
  }

  const blocked = found.length === 0 || /user profile not found/i.test(ogTitle);
  const notes = [
    `Fetched public X profile (HTTP ${httpStatus}, ${html.length} bytes).`,
    blocked ? "The public X page did not include usable profile fields." : `Extracted: ${found.join(", ")}.`,
  ];

  const text = [
    fields.name && `Name: ${fields.name}`,
    fields.username && `X username: @${fields.username}`,
    fields.about && `Bio: ${fields.about}`,
    fields.location && `Location: ${fields.location}`,
    fields.website && `Website: ${fields.website}`,
    followerCountRaw && `Public followers: ${followerCountRaw}`,
    posts.length && `Public posts:\n${posts.map((post) => `- ${post}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    url: pageUrl,
    httpStatus,
    title: ogTitle || undefined,
    description: about,
    imageUrl: ogImage || undefined,
    text: text || undefined,
    blocked,
    notes,
    fields,
    found,
    missing,
    sourceKind: "x-public",
  };
}

export class XPublicProfileProvider implements ProfileSourceProvider {
  async ingest(url: string): Promise<ProfileIngestResult> {
    let handle: string;
    let canonical: string;
    try {
      const classified = classifyXPublicUrl(url);
      handle = classified.handle;
      canonical = classified.url;
    } catch (err) {
      return {
        url,
        blocked: true,
        notes: [err instanceof Error ? err.message : "Invalid X URL"],
        fields: emptyPublicFields(),
        found: [],
        missing: ["name", "username", "about", "location", "website", "followerCount", "image", "posts"],
        sourceKind: "x-public",
      };
    }

    try {
      const response = await fetch(canonical, {
        headers: {
          "User-Agent": userAgent(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(FETCH_MS),
      });
      const html = await response.text();
      if (response.status === 404 || /user profile not found/i.test(html)) {
        return {
          url: canonical,
          httpStatus: response.status,
          blocked: true,
          notes: [`X returned ${response.status}. This handle was not found or is not public.`],
          fields: emptyPublicFields(),
          found: [],
          missing: ["name", "username", "about", "location", "website", "followerCount", "image", "posts"],
          sourceKind: "x-public",
        };
      }
      return extractXPublic(html, response.url || canonical, response.status, handle);
    } catch (err) {
      return {
        url: canonical,
        blocked: true,
        notes: [err instanceof Error ? err.message : "The public X URL could not be fetched."],
        fields: emptyPublicFields(),
        found: [],
        missing: ["name", "username", "about", "location", "website", "followerCount", "image", "posts"],
        sourceKind: "x-public",
      };
    }
  }
}
