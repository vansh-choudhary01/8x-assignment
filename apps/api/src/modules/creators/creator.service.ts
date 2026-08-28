import { z } from "zod";
import { errors } from "../../common/errors.ts";
import { ingestionQueue } from "../../infrastructure/queue/index.ts";
import { classifyLinkedInPublicUrl, profileUrlFromLinkedIn } from "../ingestion/providers/linkedinPublic.ts";
import { classifyXPublicUrl } from "../ingestion/providers/xPublic.ts";
import { CreatorProfile, type CreatorProfileDoc } from "./creatorProfile.model.ts";

function isLinkedInHost(hostname: string) {
  return /(^|\.)linkedin\.com$/i.test(hostname);
}

const linkedInUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine((value) => {
    try {
      classifyLinkedInPublicUrl(value);
      return isLinkedInHost(new URL(value).hostname);
    } catch {
      return false;
    }
  }, "Use a LinkedIn profile URL (linkedin.com/in/…) or a public post URL (linkedin.com/posts/…)");

const xUrl = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine((value) => {
    try {
      classifyXPublicUrl(value);
      return true;
    } catch {
      return false;
    }
  }, "Use a public X profile URL (x.com/username)");

const optionalPublicPostUrl = z
  .string()
  .trim()
  .refine((value) => {
    if (!value) return true;
    try {
      const kind = classifyLinkedInPublicUrl(value).kind;
      return kind === "post" || kind === "pulse" || kind === "update";
    } catch {
      return false;
    }
  }, "Use a public LinkedIn post URL (linkedin.com/posts/…)")
  .optional();

const csv = z
  .union([z.array(z.string()), z.string()])
  .transform((value) => {
    const parts = Array.isArray(value) ? value : value.split(",");
    return parts.map((item) => item.trim()).filter(Boolean).slice(0, 16);
  });

export const upsertCreatorSchema = z.object({
  linkedInUrl: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    linkedInUrl.optional(),
  ),
  xUrl: z.preprocess((value) => (value === "" || value === null ? undefined : value), xUrl.optional()),
  publicPostUrl: optionalPublicPostUrl,
  headline: z.string().trim().max(180).optional(),
  bio: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(180).optional(),
  industries: csv.optional(),
  topics: csv.optional(),
  positioning: z.string().trim().max(500).optional(),
  pricePerPost: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
  currency: z.string().trim().min(3).max(8).optional(),
  refetch: z.boolean().optional().default(true),
});

export function serializeCreator(profile: InstanceType<typeof CreatorProfile>, userName: string) {
  return {
    id: String(profile._id),
    userId: String(profile.userId),
    name: profile.publicName || userName,
    accountName: userName,
    linkedInUrl: profile.linkedInUrl ?? "",
    xUrl: profile.xUrl ?? "",
    xUsername: profile.xUsername ?? "",
    publicPostUrl: profile.publicPostUrl ?? "",
    socialSource: profile.socialSource ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    location: profile.publicLocation ?? "",
    industries: profile.industries,
    topics: profile.topics,
    positioning: profile.positioning ?? "",
    pricePerPost: profile.pricePerPost ?? null,
    currency: profile.currency,
    audienceSummary: profile.audienceSummary ?? "",
    publicName: profile.publicName ?? "",
    publicLocation: profile.publicLocation ?? "",
    currentCompany: profile.currentCompany ?? "",
    currentRole: profile.currentRole ?? "",
    education: profile.education ?? "",
    followerCount: profile.followerCount ?? null,
    followerCountRaw: profile.followerCountRaw ?? "",
    connectionCountRaw: profile.connectionCountRaw ?? "",
    extractedSkills: profile.extractedSkills ?? [],
    publicFound: profile.publicFound ?? [],
    publicMissing: profile.publicMissing ?? [],
    publicTitle: profile.publicTitle ?? "",
    publicDescription: profile.publicDescription ?? "",
    publicImageUrl: profile.publicImageUrl ?? "",
    ingestionStatus: profile.ingestionStatus,
    ingestionError: profile.ingestionError ?? "",
    ingestionNotes: profile.ingestionNotes ?? [],
    lastIngestedAt: profile.lastIngestedAt ?? null,
    enrichmentStatus: profile.enrichmentStatus,
    insights: profile.insights?.generatedAt ? profile.insights : null,
    analysisStage: profile.analysisStage ?? "idle",
    hasEmbedding: Array.isArray(profile.embedding) && profile.embedding.length > 0,
    onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
    updatedAt: profile.updatedAt,
  };
}

export async function getCreatorForUser(userId: string) {
  return CreatorProfile.findOne({ userId });
}

export async function upsertCreator(userId: string, input: z.infer<typeof upsertCreatorSchema>) {
  const existing = await CreatorProfile.findOne({ userId });
  let storedProfileUrl = input.linkedInUrl ?? existing?.linkedInUrl;
  let storedPostUrl =
    input.publicPostUrl === undefined
      ? existing?.publicPostUrl
      : input.publicPostUrl.trim() || undefined;
  let storedXUrl = input.xUrl ?? existing?.xUrl;
  if (input.linkedInUrl) {
    const kind = classifyLinkedInPublicUrl(input.linkedInUrl).kind;
    storedProfileUrl = profileUrlFromLinkedIn(input.linkedInUrl);
    if (kind !== "profile") {
      storedPostUrl = storedPostUrl || input.linkedInUrl;
    }
  }
  if (input.xUrl) {
    storedXUrl = classifyXPublicUrl(input.xUrl).url;
  }

  if (!storedProfileUrl && !storedXUrl) {
    throw errors.badRequest("Add a public LinkedIn URL and/or a public X URL.");
  }

  const urlChanged =
    (existing?.linkedInUrl ?? "") !== (storedProfileUrl ?? "") ||
    (existing?.publicPostUrl ?? "") !== (storedPostUrl ?? "") ||
    (existing?.xUrl ?? "") !== (storedXUrl ?? "");
  const shouldIngest = input.refetch !== false || urlChanged || !existing;

  const $set: {
    userId: string;
    linkedInUrl?: string;
    publicPostUrl?: string;
    xUrl?: string;
    headline?: string;
    bio?: string;
    publicLocation?: string;
    industries?: string[];
    topics?: string[];
    positioning?: string;
    pricePerPost?: number;
    currency?: string;
    ingestionStatus?: CreatorProfileDoc["ingestionStatus"];
    enrichmentStatus?: CreatorProfileDoc["enrichmentStatus"];
    analysisStage?: string;
  } = {
    userId,
  };
  if (storedProfileUrl) $set.linkedInUrl = storedProfileUrl;
  $set.publicPostUrl = storedPostUrl;
  if (storedXUrl) $set.xUrl = storedXUrl;
  if (input.headline !== undefined) $set.headline = input.headline || undefined;
  if (input.bio !== undefined) $set.bio = input.bio || undefined;
  if (input.location !== undefined) $set.publicLocation = input.location || undefined;
  if (input.industries !== undefined) $set.industries = input.industries;
  if (input.topics !== undefined) $set.topics = input.topics;
  if (input.positioning !== undefined) $set.positioning = input.positioning || undefined;
  if (input.pricePerPost !== undefined) $set.pricePerPost = input.pricePerPost;
  if (input.currency !== undefined) $set.currency = input.currency;
  if (shouldIngest) {
    $set.ingestionStatus = "QUEUED";
    $set.enrichmentStatus = "IDLE";
    $set.analysisStage = "queued";
  }

  const profile = await CreatorProfile.findOneAndUpdate(
    { userId },
    {
      $set,
      ...(shouldIngest ? { $unset: { ingestionError: 1 } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (shouldIngest) {
    await queueCreatorIngestion(profile);
  }

  return profile;
}

export async function queueCreatorIngestion(profile: InstanceType<typeof CreatorProfile>) {
  try {
    await ingestionQueue.add(
      "creator-profile",
      {
        kind: "CREATOR_PROFILE",
        creatorProfileId: String(profile._id),
        linkedInUrl: profile.linkedInUrl ?? "",
        xUrl: profile.xUrl ?? "",
      },
      { jobId: `creator:${profile._id}:${Date.now()}` },
    );
  } catch {
    const { processCreatorIngestion } = await import("./creatorIngestion.ts");
    await processCreatorIngestion(String(profile._id));
  }
}

async function requireCreator(userId: string) {
  const profile = await CreatorProfile.findOne({ userId });
  if (!profile) throw errors.notFound("Create a creator profile first");
  return profile;
}

export async function completeOnboarding(userId: string) {
  const profile = await requireCreator(userId);
  if (["IDLE", "QUEUED", "RUNNING"].includes(profile.ingestionStatus)) {
    const stale = Date.now() - new Date(profile.updatedAt).getTime() > 90_000;
    if (!stale) {
      throw errors.badRequest("Wait until we finish reading the public profiles, then confirm the card");
    }
    profile.ingestionStatus = "BLOCKED";
    profile.ingestionError =
      profile.ingestionError ||
      "Ingestion did not finish in time. You can continue and complete the card later.";
  }
  profile.onboardingCompletedAt = new Date();
  await profile.save();
  return profile;
}
