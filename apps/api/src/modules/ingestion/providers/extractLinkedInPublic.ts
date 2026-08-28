import * as cheerio from "cheerio";
import { emptyPublicFields, type ProfileIngestResult, type PublicProfileFields } from "./types.ts";

const AUTH_HINT =
  /authwall|join linkedin to see|sign in to view|sign up\s*\|\s*linkedin|linkedin login/i;

const TRACKED_KEYS = [
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
] as const;

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/see more$/i, "")
    .trim();
  return text || undefined;
}

function decode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return clean(
    value
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">"),
  );
}

function stripLinkedInSuffix(title: string): string {
  return title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
}

function parseAbbreviatedCount(raw: string): number | undefined {
  const match = raw.replace(/,/g, "").trim().match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return undefined;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return undefined;
  const suffix = match[2]?.toUpperCase();
  const factor = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
  return Math.round(base * factor);
}

function firstMeaningfulLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const line = text
    .split(/[·|•]/)[0]
    ?.replace(/Experience:.*$/i, "")
    .trim();
  return clean(line);
}

/**
 * Extracts the /in/{slug} vanity from any LinkedIn URL (profile page, ccTLD mirror
 * like in.linkedin.com, or an author URL embedded in JSON-LD). Used to verify that
 * a source we parsed actually belongs to the creator who submitted the URL, so a
 * related-post widget or a mismatched JSON-LD block can never leak a stranger's
 * identity into a creator's card.
 */
export function slugFromLinkedInUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const slugIndex = parts.findIndex((part) => part.toLowerCase() === "in");
    const slug = slugIndex >= 0 ? parts[slugIndex + 1] : undefined;
    return slug?.toLowerCase();
  } catch {
    return undefined;
  }
}

export function sameLinkedInSlug(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function isLinkedInAuthWall(html: string): boolean {
  const lower = html.slice(0, 8_000).toLowerCase();
  if (AUTH_HINT.test(lower) && !/pagekey" content="public_profile/i.test(html)) return true;
  if (/<title>\s*sign up\s*\|\s*linkedin/i.test(html)) return true;
  return false;
}

function parseOgDescription(description: string | undefined): {
  about?: string;
  company?: string;
  location?: string;
  connections?: string;
} {
  if (!description) return {};
  const about = firstMeaningfulLine(description);
  const company = clean(description.match(/Experience:\s*([^·•|]+)/i)?.[1]);
  const location = clean(description.match(/Location:\s*([^·•|]+)/i)?.[1]);
  const connections = clean(description.match(/([\d.,]+\+?\s*(?:[KMB]\s*)?connections?)/i)?.[1]);
  return { about, company, location, connections };
}

type JsonLdNode = {
  "@id"?: string;
  "@graph"?: JsonLdNode[];
  "@type"?: string;
  name?: string;
  headline?: string;
  articleBody?: string;
  author?: {
    name?: string;
    url?: string;
    image?: { url?: string } | string;
    interactionStatistic?: { interactionType?: string; userInteractionCount?: number };
  };
};

function asJsonLdNode(value: unknown): JsonLdNode | undefined {
  if (!value || typeof value !== "object") return undefined;
  return value as JsonLdNode;
}

function parseJsonLdGraph(html: string): { names: string[]; articleTitles: string[] } {
  const $ = cheerio.load(html);
  const names: string[] = [];
  const articleTitles: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed: unknown = JSON.parse(raw);
      const doc = asJsonLdNode(parsed);
      if (!doc) return;
      const nodes = Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc];
      for (const node of nodes) {
        const item = asJsonLdNode(node);
        if (!item) continue;
        if (item["@type"] === "Person" && item.name) names.push(item.name);
        if (item.author?.name) names.push(item.author.name);
        if (item["@type"] === "Article" && item.headline) articleTitles.push(item.headline);
      }
    } catch {
      /* ignore invalid json-ld */
    }
  });
  return { names: unique(names), articleTitles: unique(articleTitles) };
}

export function looksLikePublicProfileHtml(html: string, status: number): boolean {
  if (status === 999 || status === 403 || status === 401) return false;
  if (status < 200 || status >= 400) return false;
  if (isLinkedInAuthWall(html)) return false;
  return /pageKey" content="public_profile/i.test(html);
}

export function looksLikePublicPostHtml(html: string, status: number): boolean {
  if (status === 999 || status === 403 || status === 401) return false;
  if (status < 200 || status >= 400) return false;
  if (isLinkedInAuthWall(html)) return false;
  if (/pageKey" content="d_public_post/i.test(html)) return true;
  return /"@type"\s*:\s*"SocialMediaPosting"/i.test(html);
}

function pageKeyOf(html: string): string | undefined {
  return html.match(/pageKey" content="([^"]+)"/i)?.[1];
}

function trackedPresence(fields: PublicProfileFields, imageUrl?: string) {
  const found: string[] = [];
  const missing: string[] = [];
  const presence: Record<(typeof TRACKED_KEYS)[number], boolean> = {
    name: Boolean(fields.name),
    headline: Boolean(fields.headline),
    about: Boolean(fields.about),
    location: Boolean(fields.location),
    currentCompany: Boolean(fields.currentCompany),
    currentRole: Boolean(fields.currentRole),
    education: Boolean(fields.education),
    followerCount: typeof fields.followerCount === "number",
    image: Boolean(imageUrl && /^https?:\/\//i.test(imageUrl)),
    skills: fields.skills.length > 0,
  };
  for (const key of TRACKED_KEYS) {
    (presence[key] ? found : missing).push(key);
  }
  return { found, missing };
}

type SocialPosting = {
  id?: string;
  name?: string;
  imageUrl?: string;
  authorUrl?: string;
  followerCount?: number;
  headline?: string;
  articleBody?: string;
};

/**
 * LinkedIn post pages embed a "related content" carousel with SocialMediaPosting
 * JSON-LD for OTHER people's posts alongside the requested one. We collect every
 * candidate and let the caller pick the one whose @id matches the page actually
 * requested, instead of blindly using whichever block happens to parse last.
 */
function parseSocialMediaPostings(html: string): SocialPosting[] {
  const $ = cheerio.load(html);
  const out: SocialPosting[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    try {
      const parsed: unknown = JSON.parse(raw);
      const doc = asJsonLdNode(parsed);
      if (!doc) return;
      const nodes = Array.isArray(doc["@graph"]) ? doc["@graph"] : [doc];
      for (const node of nodes) {
        const item = asJsonLdNode(node);
        if (!item) continue;
        if (item["@type"] !== "SocialMediaPosting") continue;
        const image = typeof item.author?.image === "string" ? item.author.image : item.author?.image?.url;
        const stat = item.author?.interactionStatistic;
        const follow =
          typeof stat?.userInteractionCount === "number" &&
          /FollowAction/i.test(String(stat.interactionType ?? ""))
            ? stat.userInteractionCount
            : undefined;
        out.push({
          id: item["@id"],
          name: clean(item.author?.name),
          imageUrl: image && /^https?:\/\//i.test(image) ? image : undefined,
          authorUrl: item.author?.url,
          followerCount: follow,
          headline: clean(item.headline),
          articleBody: item.articleBody?.replace(/\u00a0/g, " ").trim() || undefined,
        });
      }
    } catch {
      /* ignore invalid json-ld */
    }
  });
  return out;
}

function pickMatchingPosting(postings: SocialPosting[], pageUrl: string): SocialPosting | undefined {
  if (postings.length === 0) return undefined;
  const target = pageUrl.split("?")[0].replace(/\/$/, "");
  const exact = postings.find((p) => p.id && p.id.split("?")[0].replace(/\/$/, "") === target);
  return exact ?? postings[0];
}

export function extractLinkedInPublicPost(
  html: string,
  pageUrl: string,
  httpStatus: number,
  expectedSlug?: string,
): ProfileIngestResult {
  const notes: string[] = [];
  const postings = parseSocialMediaPostings(html);
  const posting = pickMatchingPosting(postings, pageUrl) ?? {};
  if (postings.length > 1) {
    notes.push(
      `This page embedded ${postings.length} post JSON-LD blocks (related-content carousel). Only the one matching the requested URL was used.`,
    );
  }
  const authorSlug = slugFromLinkedInUrl(posting.authorUrl);
  if (expectedSlug && authorSlug && !sameLinkedInSlug(authorSlug, expectedSlug)) {
    return {
      url: pageUrl,
      httpStatus,
      blocked: true,
      notes: [
        `The post author (/in/${authorSlug}) does not match the LinkedIn profile you provided (/in/${expectedSlug}). This source was discarded, not used.`,
      ],
      fields: emptyPublicFields(),
      found: [],
      missing: [...TRACKED_KEYS],
    };
  }
  const $ = cheerio.load(html);
  const title = decode($('meta[property="og:title"]').attr("content") || $("title").first().text());
  const description = decode(
    $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content"),
  );
  const ogImage = decode($('meta[property="og:image"]').attr("content"));
  const imageUrl = posting.imageUrl || (ogImage && /^https?:\/\//i.test(ogImage) ? ogImage : undefined);
  const pageKey = pageKeyOf(html) ?? "";

  const name = posting.name && !isJunkName(posting.name) ? posting.name : undefined;
  const articleTitles = unique([posting.headline].filter((item): item is string => Boolean(item))).slice(0, 8);
  const hashtags =
    posting.articleBody
      ?.match(/#[A-Za-z][\w]*/g)
      ?.map((tag) => tag.slice(1))
      .filter(Boolean) ?? [];
  const topics = unique([...articleTitles, ...hashtags]).slice(0, 16);

  const fields: PublicProfileFields = {
    name,
    headline: undefined,
    about: undefined,
    location: undefined,
    currentCompany: undefined,
    currentRole: undefined,
    education: undefined,
    followerCount: posting.followerCount,
    followerCountRaw:
      typeof posting.followerCount === "number" ? `${posting.followerCount} followers` : undefined,
    skills: [],
    topics,
    articleTitles,
  };

  const { found, missing } = trackedPresence(fields, imageUrl);
  const hasAny = found.length > 0;
  const blocked = httpStatus >= 400 || httpStatus === 999 || !hasAny;

  notes.push(
    `Fetched a public LinkedIn post (pageKey=${pageKey || "unknown"}, HTTP ${httpStatus}). This is not the /in/ profile page.`,
  );
  if (posting.articleBody) {
    notes.push("Post body was stored as source text for AI. It is not the profile About section.");
  }
  if (typeof posting.followerCount === "number") {
    notes.push(`Public FollowAction count on the post author: ${posting.followerCount}.`);
  }
  if (missing.length) {
    notes.push(`Not present on this public post: ${missing.join(", ")}.`);
  }

  const textParts = [
    fields.name && `Name: ${fields.name}`,
    posting.authorUrl && `Author profile URL: ${posting.authorUrl}`,
    fields.followerCountRaw && `Public followers label: ${fields.followerCountRaw}`,
    posting.headline && `Public post headline: ${posting.headline}`,
    posting.articleBody && `Public post body:\n${posting.articleBody}`,
    description && `Open Graph: ${description}`,
  ].filter(Boolean);

  return {
    url: pageUrl,
    httpStatus,
    title: isJunkName(title) ? undefined : title,
    description,
    imageUrl,
    text: textParts.join("\n") || undefined,
    blocked,
    notes,
    fields,
    found,
    missing,
  };
}

export function mergeIngestResults(base: ProfileIngestResult, extra: ProfileIngestResult): ProfileIngestResult {
  const fields: PublicProfileFields = {
    name: base.fields.name || extra.fields.name,
    username: base.fields.username || extra.fields.username,
    headline: base.fields.headline || extra.fields.headline,
    about:
      unique([base.fields.about, extra.fields.about].filter(Boolean) as string[]).join("\n\n") ||
      undefined,
    location: base.fields.location || extra.fields.location,
    website: base.fields.website || extra.fields.website,
    currentCompany: base.fields.currentCompany || extra.fields.currentCompany,
    currentRole: base.fields.currentRole || extra.fields.currentRole,
    education: base.fields.education || extra.fields.education,
    followerCount: base.fields.followerCount ?? extra.fields.followerCount,
    followerCountRaw: [base.fields.followerCountRaw, extra.fields.followerCountRaw].filter(Boolean).join(" · "),
    connectionCountRaw: base.fields.connectionCountRaw || extra.fields.connectionCountRaw,
    skills: unique([...base.fields.skills, ...extra.fields.skills]),
    topics: unique([...base.fields.topics, ...extra.fields.topics]).slice(0, 16),
    articleTitles: unique([...base.fields.articleTitles, ...extra.fields.articleTitles]).slice(0, 8),
  };
  const imageUrl = base.imageUrl || extra.imageUrl;
  const { found, missing } = trackedPresence(fields, imageUrl);
  const text = [base.text, extra.text].filter(Boolean).join("\n\n");
  return {
    url: extra.blocked ? base.url : extra.url,
    httpStatus: extra.httpStatus ?? base.httpStatus,
    title: base.title || extra.title,
    description: base.description || extra.description,
    imageUrl,
    text: text || undefined,
    blocked: found.length === 0,
    notes: [...base.notes, ...extra.notes],
    fields,
    found,
    missing,
    sourceKind:
      base.sourceKind && extra.sourceKind && base.sourceKind !== extra.sourceKind
        ? "mixed"
        : extra.sourceKind || base.sourceKind,
  };
}

export function extractLinkedInPublic(
  html: string,
  pageUrl: string,
  httpStatus: number,
  expectedSlug?: string,
): ProfileIngestResult {
  const notes: string[] = [];
  const jsonLd = parseJsonLdGraph(html);
  const $ = cheerio.load(html);
  $(".contextual-sign-in-modal, .sign-in-modal, form, noscript, script, style").remove();

  const title = decode(
    $('meta[property="og:title"]').attr("content") || $("title").first().text(),
  );
  const description = decode(
    $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content"),
  );
  const ogBits = parseOgDescription(description);
  const imageUrl = decode($('meta[property="og:image"]').attr("content"));
  const canonical = $('link[rel="canonical"]').attr("href") || pageUrl;

  const canonicalSlug = slugFromLinkedInUrl(canonical);
  if (expectedSlug && canonicalSlug && !sameLinkedInSlug(canonicalSlug, expectedSlug)) {
    return {
      url: pageUrl,
      httpStatus,
      blocked: true,
      notes: [
        `This page's canonical URL (/in/${canonicalSlug}) does not match the LinkedIn profile you provided (/in/${expectedSlug}). This source was discarded, not used.`,
      ],
      fields: emptyPublicFields(),
      found: [],
      missing: [...TRACKED_KEYS],
    };
  }

  const name =
    clean($("h1.top-card-layout__title").first().text()) ||
    clean($("h1").first().text()) ||
    jsonLd.names[0] ||
    parseNameFromTitle(title);

  const location = clean(
    $(".top-card-layout__first-subline .profile-info-subheader > span").first().text() ||
      $(".top-card-layout__first-subline span").first().text() ||
      ogBits.location,
  );

  const company = clean($('[data-section="currentPositionsDetails"] a').first().text()) || ogBits.company;
  const education = clean($('[data-section="educationsDetails"] a').first().text());

  const aboutBlock = clean(
    $('[data-section="summary"] .core-section-container__content')
      .clone()
      .find("button, .sign-in-modal")
      .remove()
      .end()
      .text(),
  );
  const about = firstMeaningfulLine(aboutBlock) || ogBits.about || firstMeaningfulLine(description);

  const headlineFromDom = clean($(".top-card-layout__headline").first().text());
  let headline = headlineFromDom || headlineFromTitle(title, name, company);
  const role = roleFromAbout(about, company);
  if (!headline && role && company) {
    headline = `${role} of ${company}`;
  }

  const followerRaw = findLabeledCount($, /followers?/i);
  const connectionRaw = findLabeledCount($, /connections?/i) || ogBits.connections;
  const followerCount = followerRaw ? parseAbbreviatedCount(followerRaw.replace(/followers?/i, "").trim()) : undefined;

  const articleTitles = unique([
    ...$('[data-section="articles"] .base-main-card__title, [data-section="articles"] h3')
      .toArray()
      .map((el) => clean($(el).text()))
      .filter((item): item is string => Boolean(item)),
    ...jsonLd.articleTitles,
  ]).slice(0, 8);

  const courseTitles = $('[data-section="instructor-courses"] .base-main-card__title')
    .toArray()
    .map((el) => clean($(el).text()))
    .filter((item): item is string => Boolean(item))
    .slice(0, 6);

  const skills = extractSkillChips($);
  const topics = unique([...articleTitles, ...courseTitles, ...skills]).slice(0, 16);

  const fields: PublicProfileFields = {
    name: isJunkName(name) ? undefined : name,
    headline: isJunkName(headline) ? undefined : headline,
    about,
    location,
    currentCompany: company,
    currentRole: role,
    education,
    followerCount,
    followerCountRaw: followerRaw,
    connectionCountRaw: connectionRaw,
    skills,
    topics,
    articleTitles,
  };

  const { found, missing } = trackedPresence(fields, imageUrl);

  const authWall = AUTH_HINT.test(title ?? "") || isLinkedInAuthWall(html);
  const pageKey = $('meta[name="pageKey"]').attr("content") ?? "";
  const isPublicPage = pageKey.includes("public_profile");
  const hasAny = found.length > 0;
  const blocked =
    httpStatus >= 400 ||
    httpStatus === 999 ||
    (!isPublicPage && authWall && !hasAny) ||
    !hasAny;

  if (httpStatus === 999 || httpStatus === 403) {
    notes.push(`LinkedIn blocked the request (HTTP ${httpStatus}). No private session was used.`);
  } else if (!isPublicPage && authWall && !hasAny) {
    notes.push("LinkedIn returned a login/auth wall instead of a public profile.");
  } else if (!isPublicPage) {
    notes.push("The response was not a public_profile page. Only tags that were actually present were stored.");
  }
  if (missing.length) {
    notes.push(`Not present on the public page: ${missing.join(", ")}.`);
  }
  if (followerRaw && fields.followerCount == null) {
    notes.push(`A follower label was visible (${followerRaw}) but could not be parsed into a number.`);
  }
  if (connectionRaw) {
    notes.push(`Public connections label: ${connectionRaw}. That is not a follower count.`);
  }

  const textParts = [
    fields.name && `Name: ${fields.name}`,
    fields.headline && `Headline: ${fields.headline}`,
    fields.about && `About: ${fields.about}`,
    fields.location && `Location: ${fields.location}`,
    fields.currentCompany && `Company: ${fields.currentCompany}`,
    fields.currentRole && `Role: ${fields.currentRole}`,
    fields.education && `Education: ${fields.education}`,
    fields.followerCountRaw && `Followers: ${fields.followerCountRaw}`,
    fields.connectionCountRaw && `Connections: ${fields.connectionCountRaw}`,
    articleTitles.length && `Public articles: ${articleTitles.join("; ")}`,
    description && `Open Graph: ${description}`,
  ].filter(Boolean);

  return {
    url: canonical,
    httpStatus,
    title: isJunkName(title) ? undefined : title,
    description,
    imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) ? imageUrl : undefined,
    text: textParts.join("\n") || undefined,
    blocked,
    notes,
    fields,
    found,
    missing,
  };
}

function isJunkName(value: string | undefined): boolean {
  if (!value) return true;
  return /^(sign up|join now|linkedin|authwall)$/i.test(value.trim());
}

function parseNameFromTitle(title: string | undefined): string | undefined {
  if (!title) return undefined;
  const stripped = stripLinkedInSuffix(title);
  return clean(stripped.split(" - ")[0]);
}

function headlineFromTitle(title: string | undefined, name?: string, company?: string): string | undefined {
  if (!title) return undefined;
  const stripped = stripLinkedInSuffix(title);
  const dash = stripped.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (dash.length < 2) return undefined;
  const rest = dash.slice(1).join(" - ");
  if (name && rest.toLowerCase() === name.toLowerCase()) return undefined;
  if (company && rest.toLowerCase() === company.toLowerCase()) return undefined;
  return clean(rest);
}

function findLabeledCount($: cheerio.CheerioAPI, label: RegExp): string | undefined {
  const body = $("body").text();
  const match = body.match(new RegExp(`([\\d.,]+\\+?\\s*[KMB]?)\\s+${label.source}`, "i"));
  return match ? clean(match[0]) : undefined;
}

function extractSkillChips($: cheerio.CheerioAPI): string[] {
  const section = $('[data-section="skills"], .skills-section, #skills');
  if (!section.length) return [];
  return unique(
    section
      .find("li, .skill, a")
      .toArray()
      .map((el) => clean($(el).text()))
      .filter((item): item is string => Boolean(item && item.length < 60 && !/see more|skills/i.test(item))),
  ).slice(0, 16);
}

function roleFromAbout(about?: string, company?: string): string | undefined {
  if (!about) return undefined;
  const match = about.match(/^(?:as\s+)?(.+?)\s+(?:of|at)\s+(.+?)(?:,|\.|$)/i);
  if (!match) return undefined;
  const role = clean(match[1]);
  const ofCompany = clean(match[2]);
  if (
    company &&
    ofCompany &&
    !company.toLowerCase().includes(ofCompany.toLowerCase()) &&
    !ofCompany.toLowerCase().includes(company.toLowerCase())
  ) {
    return role;
  }
  return role;
}

function unique(values: string[]): string[] {
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
