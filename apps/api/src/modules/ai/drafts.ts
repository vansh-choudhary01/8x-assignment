import { z } from "zod";
import { errors } from "../../common/errors.ts";
import { completeJsonParsed } from "../../infrastructure/ai/openai.ts";
import { createCampaignSchema } from "../campaigns/campaign.service.ts";
import { getBrandForUser, serializeBrand } from "../brands/brand.service.ts";
import { getCreatorForUser, serializeCreator } from "../creators/creator.service.ts";
import { getCampaign, serializeCampaign, brandName } from "../campaigns/campaign.service.ts";
import { getMarketplaceCreator } from "../creators/marketplace.service.ts";
import { listMessages } from "../messaging/message.service.ts";
import { getCollaborationForUser, serializeCollaboration } from "../collaborations/collaboration.service.ts";
import type { AiActor } from "./types.ts";

const looseScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

function text() {
  return z
    .union([looseScalar, z.array(looseScalar)])
    .optional()
    .transform((value) => {
      if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).join(", ");
      return value == null ? "" : String(value).trim();
    });
}

const optionalAmount = z.union([z.number(), z.string(), z.null()]).optional();
const optionalCopy = z.union([z.array(z.string()), z.string(), z.null()]).optional();

const campaignDraftSchema = z
  .object({
    title: text().optional(),
    campaignTitle: text().optional(),
    name: text().optional(),
    description: text().optional(),
    brief: text().optional(),
    goal: text().optional(),
    objective: text().optional(),
    targetAudience: text().optional(),
    audience: text().optional(),
    industry: text().optional(),
    platform: text().optional(),
    pricePerPost: optionalAmount,
    budget: optionalAmount,
    deliverables: optionalCopy,
    requirements: optionalCopy,
    campaign: z
      .object({
        title: looseScalar.optional(),
        campaignTitle: looseScalar.optional(),
        name: looseScalar.optional(),
        description: looseScalar.optional(),
        brief: looseScalar.optional(),
        goal: looseScalar.optional(),
        objective: looseScalar.optional(),
        targetAudience: looseScalar.optional(),
        audience: looseScalar.optional(),
        industry: looseScalar.optional(),
        platform: looseScalar.optional(),
        pricePerPost: optionalAmount,
        budget: optionalAmount,
        deliverables: optionalCopy,
        requirements: optionalCopy,
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough()
  .transform((value) => {
    const nested = value.campaign;
    const pick = (
      keys: Array<
        | "title"
        | "campaignTitle"
        | "name"
        | "description"
        | "brief"
        | "goal"
        | "objective"
        | "targetAudience"
        | "audience"
        | "industry"
        | "platform"
        | "requirements"
      >,
    ) => {
      for (const key of keys) {
        const raw = value[key] ?? nested?.[key];
        if (raw == null || raw === "") continue;
        if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean).join(", ");
        return String(raw).trim();
      }
      return "";
    };
    const priceRaw = value.pricePerPost ?? nested?.pricePerPost;
    const price = typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
    return createCampaignSchema.parse({
      title: pick(["title", "campaignTitle", "name"]),
      description: pick(["description", "brief"]),
      goal: pick(["goal", "objective"]),
      targetAudience: pick(["targetAudience", "audience"]),
      industry: pick(["industry"]),
      platform: pick(["platform"]) || "LinkedIn",
      pricePerPost: Number.isFinite(price) && price > 0 ? price : undefined,
      deliverables: value.deliverables ?? nested?.deliverables ?? undefined,
      requirements: pick(["requirements"]),
    });
  });

const applicationDraftSchema = z
  .object({
    pitch: text().optional(),
    application: text().optional(),
    body: text().optional(),
    fitSummary: text().optional(),
    applyRecommendation: z.union([z.string(), z.enum(["apply", "skip", "ask"])]).optional(),
    reasons: z.union([z.array(looseScalar), z.string()]).optional(),
  })
  .passthrough()
  .transform((value) => {
    const pitch = [value.pitch, value.application, value.body].find((item) => item && item.length >= 10);
    if (!pitch) throw errors.badRequest("The model did not return an application pitch from the stored card");
    const rec = String(value.applyRecommendation ?? "ask").toLowerCase();
    const reasons = Array.isArray(value.reasons)
      ? value.reasons.map((item) => String(item).trim()).filter(Boolean)
      : [];
    return {
      pitch,
      fitSummary: value.fitSummary ?? "",
      applyRecommendation: (["apply", "skip", "ask"].includes(rec) ? rec : "ask") as "apply" | "skip" | "ask",
      reasons,
    };
  });

const inviteDraftSchema = z
  .object({
    message: text().optional(),
    body: text().optional(),
    invitation: text().optional(),
  })
  .passthrough()
  .transform((value) => {
    const message = [value.message, value.body, value.invitation].find((item) => item && item.length >= 10);
    if (!message) throw errors.badRequest("The model did not return invitation copy");
    return { message };
  });

const replyDraftSchema = z
  .object({
    body: text().optional(),
    message: text().optional(),
    reply: text().optional(),
  })
  .passthrough()
  .transform((value) => {
    const body = [value.body, value.message, value.reply].find((item) => item && item.length >= 1);
    if (!body) throw errors.badRequest("The model did not return a reply");
    return { body };
  });

export async function draftCampaignFromIntent(actor: AiActor, intent: string) {
  const brand = await getBrandForUser(actor.id);
  const company = brand ? serializeBrand(brand) : null;
  return completeJsonParsed(
    campaignDraftSchema,
    "You write LinkedIn campaign briefs for Naano. Use only the company intelligence and the user's intent. JSON keys: title, description, goal, targetAudience, industry, platform, pricePerPost, deliverables, requirements. If a rate is not in the intent or company source, omit pricePerPost. Do not invent metrics, customer counts, or budget unless the user stated them.",
    JSON.stringify({ intent, company }),
  );
}

export async function draftApplicationForCampaign(actor: AiActor, campaignId: string) {
  const [profile, campaign] = await Promise.all([
    getCreatorForUser(actor.id),
    getCampaign(campaignId),
  ]);
  const card = profile ? serializeCreator(profile, actor.name) : null;
  const brief = serializeCampaign(campaign, await brandName(String(campaign.brandUserId)));
  return completeJsonParsed(
    applicationDraftSchema,
    "You draft a creator application from the stored Creator Card and the real campaign brief. JSON keys: pitch, fitSummary, applyRecommendation (apply|skip|ask), reasons (array of strings). Recommend apply only when the stored card actually overlaps. Never invent followers, clients, or results.",
    JSON.stringify({ card, brief }),
  );
}

export async function draftInvitationMessage(actor: AiActor, creatorId: string, campaignId: string) {
  const [creator, campaign, brand] = await Promise.all([
    getMarketplaceCreator(creatorId),
    getCampaign(campaignId),
    getBrandForUser(actor.id),
  ]);
  if (String(campaign.brandUserId) !== actor.id) {
    throw new Error("Not your campaign");
  }
  return completeJsonParsed(
    inviteDraftSchema,
    "Draft a short invitation a brand would send. Ground it in the stored creator card and campaign. Do not invent stats.",
    JSON.stringify({
      company: brand ? serializeBrand(brand) : null,
      creator: {
        name: creator.name,
        headline: creator.headline,
        positioning: creator.positioning,
        topics: creator.topics,
        industries: creator.industries,
      },
      campaign: serializeCampaign(campaign),
    }),
  );
}

export async function draftCollaborationReply(actor: AiActor, collaborationId: string, instruction: string) {
  const collaboration = await getCollaborationForUser(collaborationId, actor.id);
  const messages = await listMessages(collaborationId, actor.id);
  const lastMessage = messages[messages.length - 1];
  const lastFromMe = lastMessage ? String(lastMessage.senderUserId) === actor.id : false;
  return completeJsonParsed(
    replyDraftSchema,
    "Draft a message that the current user (\"me\") will send next in this collaboration thread. Write it in first person, from \"me\". Never write it as if you are \"them\" — you are always drafting for \"me\" to send. If the most recent message was already sent by \"me\", draft a natural follow-up or check-in rather than pretending to answer yourself. Use only the stored messages and the instruction. Do not claim work was published or paid unless those messages say so.",
    JSON.stringify({
      instruction,
      lastMessageFrom: messages.length ? (lastFromMe ? "me" : "them") : "none",
      collaboration: await serializeCollaboration(collaboration),
      messages: messages.map((message) => ({
        from: String(message.senderUserId) === actor.id ? "me" : "them",
        body: message.body,
      })),
    }),
  );
}
