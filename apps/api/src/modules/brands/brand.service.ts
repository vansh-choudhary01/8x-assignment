import { z } from "zod";
import { errors } from "../../common/errors.ts";
import { ingestionQueue } from "../../infrastructure/queue/index.ts";
import { BrandProfile, type BrandProfileDoc } from "./brandProfile.model.ts";

export const upsertBrandSchema = z.object({
  websiteUrl: z
    .string()
    .trim()
    .url("Enter a valid website URL")
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    }, "Enter an http(s) website URL"),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  refetch: z.boolean().optional().default(true),
});

export function serializeBrand(profile: InstanceType<typeof BrandProfile>) {
  return {
    id: String(profile._id),
    userId: String(profile.userId),
    companyName: profile.companyName ?? "",
    websiteUrl: profile.websiteUrl,
    ingestionStatus: profile.ingestionStatus,
    ingestionError: profile.ingestionError ?? "",
    ingestionNotes: profile.ingestionNotes ?? [],
    pageCount: profile.pageCount ?? 0,
    chunkCount: profile.chunkCount ?? 0,
    lastIngestedAt: profile.lastIngestedAt ?? null,
    intelligence: profile.intelligence?.generatedAt || profile.intelligence?.whatTheyDo
      ? profile.intelligence
      : null,
    hasEmbedding: Array.isArray(profile.embedding) && profile.embedding.length > 0,
    analysisStage: profile.analysisStage ?? "idle",
    onboardingCompletedAt: profile.onboardingCompletedAt ?? null,
    updatedAt: profile.updatedAt,
  };
}

export async function getBrandForUser(userId: string) {
  return BrandProfile.findOne({ userId });
}

export async function upsertBrand(userId: string, input: z.infer<typeof upsertBrandSchema>) {
  const existing = await BrandProfile.findOne({ userId });
  const urlChanged = existing?.websiteUrl !== input.websiteUrl;
  const shouldIngest = input.refetch !== false || urlChanged || !existing;

  const $set: {
    userId: string;
    websiteUrl: string;
    companyName?: string;
    ingestionStatus?: BrandProfileDoc["ingestionStatus"];
    ingestionNotes?: string[];
    pageCount?: number;
    chunkCount?: number;
    analysisStage?: string;
  } = {
    userId,
    websiteUrl: input.websiteUrl,
  };
  if (input.companyName !== undefined && input.companyName !== "") {
    $set.companyName = input.companyName;
  }
  if (shouldIngest) {
    $set.ingestionStatus = "QUEUED";
    $set.ingestionNotes = [];
    $set.pageCount = 0;
    $set.chunkCount = 0;
    $set.analysisStage = "queued";
  }

  const profile = await BrandProfile.findOneAndUpdate(
    { userId },
    {
      $set,
      ...(shouldIngest ? { $unset: { ingestionError: 1 } } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (shouldIngest) {
    try {
      await ingestionQueue.add(
        "website",
        { kind: "WEBSITE", brandProfileId: String(profile._id), url: profile.websiteUrl },
        { jobId: `brand:${profile._id}:${Date.now()}` },
      );
    } catch {
      const { processBrandIngestion } = await import("./brandIngestion.ts");
      await processBrandIngestion(String(profile._id));
    }
  }

  return profile;
}

export async function completeBrandOnboarding(userId: string) {
  const profile = await BrandProfile.findOne({ userId });
  if (!profile) throw errors.notFound("Save a company website first");
  if (["IDLE", "QUEUED", "RUNNING"].includes(profile.ingestionStatus)) {
    const stale = Date.now() - new Date(profile.updatedAt).getTime() > 90_000;
    if (!stale) {
      throw errors.badRequest("Wait until we finish reading the website, then confirm to enter the workspace");
    }
    profile.ingestionStatus = "FAILED";
    profile.ingestionError =
      profile.ingestionError ||
      "Website ingest did not finish in time. You can continue and retry from company settings.";
  }
  profile.onboardingCompletedAt = new Date();
  await profile.save();
  return profile;
}
