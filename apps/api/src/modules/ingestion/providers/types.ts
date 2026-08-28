export type PublicProfileFields = {
  name?: string;
  username?: string;
  headline?: string;
  about?: string;
  location?: string;
  website?: string;
  currentCompany?: string;
  currentRole?: string;
  education?: string;
  followerCount?: number;
  followerCountRaw?: string;
  connectionCountRaw?: string;
  skills: string[];
  topics: string[];
  articleTitles: string[];
};

export type ProfileSourceKind = "oauth" | "linkedin-public" | "x-public" | "mixed";

export type ProfileIngestResult = {
  url: string;
  httpStatus?: number;
  title?: string;
  description?: string;
  imageUrl?: string;
  text?: string;
  blocked: boolean;
  notes: string[];
  fields: PublicProfileFields;
  found: string[];
  missing: string[];
  sourceKind?: ProfileSourceKind;
};

export type WebsitePage = {
  url: string;
  httpStatus: number;
  title?: string;
  text: string;
  html?: string;
};

export type WebsiteIngestResult = {
  pages: WebsitePage[];
  notes: string[];
};

export type ProfileIngestOptions = {
  extraPublicUrls?: string[];
  linkedInUrl?: string;
  xUrl?: string;
  /** Reserved for a later OAuth provider. Public ingest does not use it. */
  userId?: string;
};

export interface ProfileSourceProvider {
  ingest(url: string, options?: ProfileIngestOptions): Promise<ProfileIngestResult>;
}

export interface WebsiteSourceProvider {
  ingest(url: string): Promise<WebsiteIngestResult>;
}

export function emptyPublicFields(): PublicProfileFields {
  return { skills: [], topics: [], articleTitles: [] };
}
