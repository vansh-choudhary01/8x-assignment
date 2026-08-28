import { LinkedInPublicProfileProvider } from "./linkedinPublic.ts";
import { WebsiteFetchProvider } from "./websiteFetch.ts";
import { XPublicProfileProvider } from "./xPublic.ts";
import { mergeIngestResults } from "./extractLinkedInPublic.ts";
import {
  emptyPublicFields,
  type ProfileIngestOptions,
  type ProfileIngestResult,
  type ProfileSourceProvider,
  type WebsiteSourceProvider,
} from "./types.ts";

function useful(result?: ProfileIngestResult) {
  return Boolean(result && !result.blocked && result.found.length > 0);
}

function isLinkedInUrl(raw?: string) {
  if (!raw) return false;
  try {
    return /(^|\.)linkedin\.com$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

function isXUrl(raw?: string) {
  if (!raw) return false;
  try {
    return /(^|\.)(x\.com|twitter\.com)$/i.test(new URL(raw).hostname);
  } catch {
    return false;
  }
}

class CompositeProfileSourceProvider implements ProfileSourceProvider {
  private linkedIn = new LinkedInPublicProfileProvider();
  private x = new XPublicProfileProvider();

  async ingest(url: string, options?: ProfileIngestOptions): Promise<ProfileIngestResult> {
    const linkedInUrl = options?.linkedInUrl?.trim() || (isLinkedInUrl(url) ? url.trim() : "");
    const xUrl = options?.xUrl?.trim() || (isXUrl(url) ? url.trim() : "");

    const [linkedInResult, xResult] = await Promise.all([
      linkedInUrl ? this.linkedIn.ingest(linkedInUrl, { extraPublicUrls: options?.extraPublicUrls }) : undefined,
      xUrl ? this.x.ingest(xUrl) : undefined,
    ]);

    if (useful(linkedInResult) && useful(xResult)) {
      const merged = mergeIngestResults(linkedInResult!, xResult!);
      return {
        ...merged,
        sourceKind: "mixed",
        notes: ["Combined public LinkedIn data with public X data.", ...merged.notes],
      };
    }
    if (useful(linkedInResult)) {
      const notes = xResult ? [...linkedInResult!.notes, ...xResult.notes] : linkedInResult!.notes;
      return { ...linkedInResult!, notes };
    }
    if (useful(xResult)) {
      const notes = linkedInResult ? [...xResult!.notes, ...linkedInResult.notes] : xResult!.notes;
      return { ...xResult!, notes };
    }

    const notes = [
      ...(linkedInResult?.notes ?? []),
      ...(xResult?.notes ?? []),
      !linkedInUrl && !xUrl
        ? "Add a public LinkedIn URL and/or a public X URL."
        : "No usable public HTML was returned from the sources that were provided.",
    ];
    return {
      url: linkedInUrl || xUrl || url,
      blocked: true,
      notes,
      fields: emptyPublicFields(),
      found: [],
      missing: [...(linkedInResult?.missing ?? []), ...(xResult?.missing ?? [])],
      sourceKind: linkedInResult && xResult ? "mixed" : xResult?.sourceKind || linkedInResult?.sourceKind,
    };
  }
}

export function getProfileSourceProvider(): ProfileSourceProvider {
  return new CompositeProfileSourceProvider();
}

export function getWebsiteSourceProvider(): WebsiteSourceProvider {
  return new WebsiteFetchProvider();
}

export type { ProfileSourceProvider, WebsiteSourceProvider } from "./types.ts";
