import { config } from "../../../config.ts";
import {
  extractLinkedInPublic,
  extractLinkedInPublicPost,
  isLinkedInAuthWall,
  looksLikePublicPostHtml,
  looksLikePublicProfileHtml,
  mergeIngestResults,
  sameLinkedInSlug,
  slugFromLinkedInUrl,
} from "./extractLinkedInPublic.ts";
import {
  emptyPublicFields,
  type ProfileIngestOptions,
  type ProfileIngestResult,
  type ProfileSourceProvider,
} from "./types.ts";

const LINKEDIN_HOST = /(^|\.)linkedin\.com$/i;
const FETCH_MS = 18_000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EMPTY_TRACKED = [
  "name",
  "headline",
  "about",
  "location",
  "currentCompany",
  "currentRole",
  "education",
  "followerCount",
  "image",
  "skills",
];

function userAgent(): string {
  const configured = config.ingestUserAgent;
  if (configured && !/^NaanoBot\//i.test(configured)) return configured;
  return BROWSER_UA;
}

export type LinkedInPublicKind = "profile" | "post" | "pulse" | "update";

export function classifyLinkedInPublicUrl(raw: string): { url: URL; kind: LinkedInPublicKind } {
  const parsed = new URL(raw);
  if (!LINKEDIN_HOST.test(parsed.hostname)) {
    throw new Error("Not a LinkedIn URL");
  }
  const path = parsed.pathname.toLowerCase();
  if (path.startsWith("/in/")) return { url: parsed, kind: "profile" };
  if (path.startsWith("/posts/")) return { url: parsed, kind: "post" };
  if (path.startsWith("/pulse/")) return { url: parsed, kind: "pulse" };
  if (path.startsWith("/feed/update/")) return { url: parsed, kind: "update" };
  throw new Error("Use a LinkedIn profile URL (linkedin.com/in/…) or a public post URL (linkedin.com/posts/…)");
}

function slugFromProfilePath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const slugIndex = parts.findIndex((part) => part.toLowerCase() === "in");
  return slugIndex >= 0 ? parts[slugIndex + 1] : undefined;
}

function slugFromPostPath(pathname: string): string | undefined {
  const parts = pathname.split("/").filter(Boolean);
  const postsIndex = parts.findIndex((part) => part.toLowerCase() === "posts");
  const segment = postsIndex >= 0 ? parts[postsIndex + 1] : undefined;
  if (!segment) return undefined;
  const vanity = segment.split("_")[0];
  return vanity || undefined;
}

export function profileUrlFromLinkedIn(raw: string): string {
  const { url, kind } = classifyLinkedInPublicUrl(raw);
  const host = url.hostname.toLowerCase();
  if (kind === "profile") {
    const slug = slugFromProfilePath(url.pathname);
    if (!slug) throw new Error("Use a LinkedIn profile URL (linkedin.com/in/…)");
    return `https://${host}/in/${slug}/`;
  }
  const slug = slugFromPostPath(url.pathname);
  if (slug) return `https://${host}/in/${slug}/`;
  return url.toString();
}

function fetchUrlFor(raw: string): string {
  const { url, kind } = classifyLinkedInPublicUrl(raw);
  if (kind === "profile") return profileUrlFromLinkedIn(raw);
  url.hash = "";
  return url.toString();
}

function emptyBlocked(url: string, notes: string[], httpStatus?: number): ProfileIngestResult {
  return {
    url,
    httpStatus,
    blocked: true,
    notes,
    fields: emptyPublicFields(),
    found: [],
    missing: [...EMPTY_TRACKED],
    sourceKind: "linkedin-public",
  };
}

async function fetchOnce(url: string): Promise<{ status: number; url: string; html: string }> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": userAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Upgrade-Insecure-Requests": "1",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const html = await response.text();
  return { status: response.status, url: response.url || url, html };
}

function describeFetch(target: string, status: number, html: string): string {
  const pageKey = html.match(/pageKey" content="([^"]+)"/i)?.[1] ?? "none";
  const auth = isLinkedInAuthWall(html) ? "authwall" : "no-authwall";
  return `${target} → HTTP ${status}, ${html.length} bytes, pageKey=${pageKey}, ${auth}.`;
}

function parseFetched(
  html: string,
  finalUrl: string,
  status: number,
  kind: LinkedInPublicKind,
  expectedSlug: string,
): ProfileIngestResult | undefined {
  if (kind === "profile" && looksLikePublicProfileHtml(html, status)) {
    return extractLinkedInPublic(html, finalUrl, status, expectedSlug);
  }
  if (kind !== "profile" && looksLikePublicPostHtml(html, status)) {
    return extractLinkedInPublicPost(html, finalUrl, status, expectedSlug);
  }
  if (kind !== "profile" && looksLikePublicProfileHtml(html, status)) {
    return extractLinkedInPublic(html, finalUrl, status, expectedSlug);
  }
  return undefined;
}

/**
 * Unauthenticated fetch of the URL the creator pasted. No login cookies, no private
 * Voyager APIs, no locale-host hopping. Guest /in/ pages are often HTTP 999 from
 * this runtime; public /posts/ pages are a separate LinkedIn surface that still
 * returns JSON-LD when the creator provides that URL.
 */
export class LinkedInPublicProfileProvider implements ProfileSourceProvider {
  async ingest(url: string, options?: ProfileIngestOptions): Promise<ProfileIngestResult> {
    const notes: string[] = [];

    let primaryKind: LinkedInPublicKind;
    let primaryFetch: string;
    let profileUrl: string;
    let targetSlug: string;
    try {
      primaryKind = classifyLinkedInPublicUrl(url).kind;
      primaryFetch = fetchUrlFor(url);
      profileUrl = profileUrlFromLinkedIn(url);
      targetSlug = slugFromLinkedInUrl(profileUrl) ?? "";
    } catch (err) {
      return emptyBlocked(url, [err instanceof Error ? err.message : "Invalid LinkedIn URL"]);
    }

    const extra = (options?.extraPublicUrls ?? []).filter((item) => item.trim() && item.trim() !== url);
    const queue: { raw: string; kind: LinkedInPublicKind; fetch: string }[] = [
      { raw: url, kind: primaryKind, fetch: primaryFetch },
    ];
    for (const item of extra) {
      try {
        const classified = classifyLinkedInPublicUrl(item);
        const itemSlug =
          classified.kind === "profile"
            ? slugFromProfilePath(classified.url.pathname)
            : slugFromPostPath(classified.url.pathname);
        if (!sameLinkedInSlug(itemSlug, targetSlug)) {
          notes.push(
            `${item} looks like a different LinkedIn profile (/in/${itemSlug ?? "unknown"}) than the one you provided (/in/${targetSlug}). It was not fetched.`,
          );
          continue;
        }
        queue.push({ raw: item, kind: classified.kind, fetch: fetchUrlFor(item) });
      } catch (err) {
        notes.push(err instanceof Error ? err.message : "An extra URL was not a public LinkedIn URL.");
      }
    }

    let combined: ProfileIngestResult | undefined;

    try {
      for (const item of queue) {
        const response = await fetchOnce(item.fetch);
        notes.push(describeFetch(item.fetch, response.status, response.html));

        const parsed = parseFetched(response.html, response.url, response.status, item.kind, targetSlug);
        if (!parsed || parsed.blocked) {
          if (parsed?.blocked && parsed.found.length === 0 && parsed.notes.some((n) => n.includes("does not match"))) {
            notes.push(...parsed.notes);
          } else if (response.status === 999) {
            notes.push(
              "LinkedIn returned HTTP 999 (bot interstitial) for this guest request. That is a block, not an empty profile.",
            );
          } else if (isLinkedInAuthWall(response.html)) {
            notes.push("LinkedIn returned a login/auth wall instead of public HTML.");
          } else if (!parsed) {
            notes.push("Response was not public_profile or d_public_post HTML, so nothing was extracted.");
          }
          continue;
        }
        combined = combined ? mergeIngestResults(combined, parsed) : parsed;
      }

      if (combined && !combined.blocked && combined.found.length > 0) {
        return { ...combined, url: profileUrl, sourceKind: "linkedin-public", notes: [...notes, ...combined.notes] };
      }

      notes.push(
        "No usable public LinkedIn HTML was returned. Guest /in/ profile pages are often blocked from this network. A public /posts/ URL from the same profile is a separate page LinkedIn still serves logged-out, and is the supported fallback.",
      );
      return emptyBlocked(profileUrl, notes, 999);
    } catch (err) {
      notes.push(err instanceof Error ? err.message : "The public LinkedIn URL could not be fetched.");
      return emptyBlocked(profileUrl, notes);
    }
  }
}
