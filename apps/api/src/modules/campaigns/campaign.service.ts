import { z } from "zod";
import { CAMPAIGN_STATUSES } from "@naano/shared";
import { errors } from "../../common/errors.ts";
import { embedTexts, hasOpenAI } from "../../infrastructure/ai/openai.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { BrandProfile } from "../brands/brandProfile.model.ts";
import { User } from "../users/user.model.ts";
import { Campaign } from "./campaign.model.ts";

const csv = z.preprocess((value) => {
  if (value == null || value === "") return [];
  return value;
}, z.union([z.array(z.string()), z.string()]).transform((value) => {
  const parts = Array.isArray(value) ? value : value.split(",");
  return parts.map((item) => item.trim()).filter(Boolean);
}));

function optionalPositiveNumber() {
  return z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.coerce.number().positive().optional(),
  );
}

export const createCampaignSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(8000),
  goal: z.string().trim().min(3).max(500),
  targetAudience: z.string().trim().min(3).max(500),
  industry: z.string().trim().min(2).max(120),
  platform: z.string().trim().max(40).optional().nullable().transform((value) => value || "LinkedIn"),
  budget: optionalPositiveNumber(),
  pricePerPost: optionalPositiveNumber(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(8)
    .optional()
    .nullable()
    .transform((value) => value || "USD"),
  deliverables: csv,
  requirements: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .nullable()
    .transform((value) => value || ""),
  deadline: z.string().optional().nullable().transform((value) => value || undefined),
  landingUrl: z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.string().trim().url().optional(),
  ),
  status: z.enum(CAMPAIGN_STATUSES).optional().default("OPEN"),
});

export function serializeCampaign(
  campaign: InstanceType<typeof Campaign>,
  brandName?: string,
) {
  return {
    id: String(campaign._id),
    brandUserId: String(campaign.brandUserId),
    brandName: brandName ?? "",
    title: campaign.title,
    description: campaign.description,
    goal: campaign.goal,
    targetAudience: campaign.targetAudience,
    industry: campaign.industry,
    platform: campaign.platform,
    budget: campaign.budget ?? null,
    pricePerPost: campaign.pricePerPost ?? null,
    currency: campaign.currency,
    deliverables: campaign.deliverables,
    requirements: campaign.requirements,
    deadline: campaign.deadline ?? null,
    landingUrl: campaign.landingUrl ?? "",
    status: campaign.status,
    createdAt: campaign.createdAt,
  };
}

export async function createCampaign(brandUserId: string, input: z.infer<typeof createCampaignSchema>) {
  let embedding: number[] | undefined;
  if (hasOpenAI()) {
    const [vector] = await embedTexts([
      `${input.title}\n${input.industry}\n${input.goal}\n${input.targetAudience}\n${input.description}`,
    ]);
    embedding = vector;
  }
  return Campaign.create({
    brandUserId,
    ...input,
    embedding,
    deadline: input.deadline ? new Date(input.deadline) : undefined,
  });
}

export async function listCampaignsForBrand(brandUserId: string) {
  return Campaign.find({ brandUserId }).sort({ createdAt: -1 });
}

export async function listOpenCampaigns() {
  return Campaign.find({ status: { $in: ["OPEN", "IN_PROGRESS"] } }).sort({ createdAt: -1 });
}

export async function getCampaign(id: string) {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw errors.notFound("Campaign not found");
  return campaign;
}

export async function brandName(userId: string) {
  const [brand, user] = await Promise.all([BrandProfile.findOne({ userId }), User.findById(userId)]);
  return brand?.companyName || user?.name || "";
}

export async function viewCampaign(id: string, actorUserId?: string) {
  const campaign = await getCampaign(id);
  const isOwner = actorUserId && String(campaign.brandUserId) === actorUserId;
  if (!isOwner) {
    await recordEvent({
      type: "CAMPAIGN_VIEW",
      actorUserId,
      campaignId: campaign._id,
      metadata: { title: campaign.title },
    });
  }
  return campaign;
}
