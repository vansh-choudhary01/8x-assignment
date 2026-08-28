import {
  COLLABORATION_STATUSES,
  FUNNEL_EVENT_TYPES,
  type CollaborationStatus,
} from "@naano/shared";
import { z } from "zod";
import { AppError } from "../../common/errors.ts";
import { analyticsForUser, funnelBreakdown, funnelFor } from "../analytics/analytics.service.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { TrackingLink } from "../analytics/trackingLink.model.ts";
import {
  acceptApplication,
  acceptInvite,
  applyToCampaign,
  inviteCreator,
  listApplicationsForCampaign,
  listApplicationsForCreator,
  rejectApplication,
} from "../applications/application.service.ts";
import { getBrandForUser, serializeBrand } from "../brands/brand.service.ts";
import {
  brandName,
  createCampaign,
  createCampaignSchema,
  getCampaign,
  listCampaignsForBrand,
  listOpenCampaigns,
  serializeCampaign,
} from "../campaigns/campaign.service.ts";
import {
  getCollaborationForUser,
  listCollaborations,
  serializeCollaboration,
  transitionCollaboration,
} from "../collaborations/collaboration.service.ts";
import { getCreatorForUser, serializeCreator, upsertCreator } from "../creators/creator.service.ts";
import { getMarketplaceCreator, listMarketplaceCreators } from "../creators/marketplace.service.ts";
import { earningsFor } from "../earnings/earnings.service.ts";
import { rankCreatorsForCampaign } from "../matching/rank.ts";
import { searchCreatorsByQuery } from "../matching/search.ts";
import { listMessages, sendMessage } from "../messaging/message.service.ts";
import {
  draftApplicationForCampaign,
  draftCampaignFromIntent,
  draftCollaborationReply,
  draftInvitationMessage,
} from "./drafts.ts";
import { objectParams, str, type AiActor, type AiTool, type ToolArgs, type ToolOutcome } from "./types.ts";

const idField = z.string().trim().min(1);

function fail(err: unknown): ToolOutcome {
  if (err instanceof AppError) {
    return { ok: false, error: err.message };
  }
  return { ok: false, error: err instanceof Error ? err.message : "Tool failed" };
}

async function wrap<T extends object | string | number | boolean | null>(run: () => Promise<T>) {
  try {
    return { ok: true as const, data: await run() };
  } catch (err) {
    return fail(err);
  }
}

const getMyProfile: AiTool = {
  name: "get_my_profile",
  description: "Load the signed-in creator card or brand company intelligence from storage.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "Load my stored profile",
  execute: async (actor) =>
    wrap(async () => {
      if (actor.role === "CREATOR") {
        const profile = await getCreatorForUser(actor.id);
        return { profile: profile ? serializeCreator(profile, actor.name) : null };
      }
      const profile = await getBrandForUser(actor.id);
      return { profile: profile ? serializeBrand(profile) : null };
    }),
};

const getCampaignTool: AiTool = {
  name: "get_campaign",
  description: "Load one stored campaign brief. Does not record a campaign view event.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({ campaignId: idField }),
  parameters: objectParams({ campaignId: str("Campaign id") }, ["campaignId"]),
  summary: (args) => `Load campaign ${args.campaignId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const campaign = await getCampaign(String(args.campaignId));
      if (actor.role === "BRAND" && String(campaign.brandUserId) !== actor.id) {
        throw new Error("Not your campaign");
      }
      return { campaign: serializeCampaign(campaign, await brandName(String(campaign.brandUserId))) };
    }),
};

const listCampaignsTool: AiTool = {
  name: "list_campaigns",
  description: "List campaigns the user can see: the brand's own, or open campaigns for a creator.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "List visible campaigns",
  execute: (actor) =>
    wrap(async () => {
      const items = actor.role === "BRAND" ? await listCampaignsForBrand(actor.id) : await listOpenCampaigns();
      const names = await Promise.all(items.map((item) => brandName(String(item.brandUserId))));
      return { campaigns: items.map((item, index) => serializeCampaign(item, names[index])) };
    }),
};

const getCollaborationTool: AiTool = {
  name: "get_collaboration",
  description: "Load a collaboration the user is a party to, including tracking URLs if a post was published.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({ collaborationId: idField }),
  parameters: objectParams({ collaborationId: str("Collaboration id") }, ["collaborationId"]),
  summary: (args) => `Load collaboration ${args.collaborationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const item = await getCollaborationForUser(String(args.collaborationId), actor.id);
      return { collaboration: await serializeCollaboration(item) };
    }),
};

const listCollaborationsTool: AiTool = {
  name: "list_collaborations",
  description: "List this user's collaborations.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "List collaborations",
  execute: (actor) =>
    wrap(async () => {
      const items = await listCollaborations(actor.id, actor.role);
      return { collaborations: await Promise.all(items.map((item) => serializeCollaboration(item))) };
    }),
};

const getMessagesTool: AiTool = {
  name: "get_messages",
  description: "Load the stored message thread for a collaboration.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({ collaborationId: idField }),
  parameters: objectParams({ collaborationId: str("Collaboration id") }, ["collaborationId"]),
  summary: (args) => `Load messages for ${args.collaborationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const messages = await listMessages(String(args.collaborationId), actor.id);
      return {
        messages: messages.map((message) => ({
          id: String(message._id),
          fromMe: String(message.senderUserId) === actor.id,
          body: message.body,
          createdAt: message.createdAt,
        })),
      };
    }),
};

const getAnalyticsTool: AiTool = {
  name: "get_analytics",
  description:
    "Load stored analytics events, funnel totals, and breakdowns by creator/campaign/collaboration. Empty means nothing was recorded.",
  roles: ["BRAND", "CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "Load stored analytics",
  execute: (actor) =>
    wrap(async () => {
      const [summary, funnel, breakdown] = await Promise.all([
        analyticsForUser(actor.id, actor.role),
        funnelFor(actor.id, actor.role),
        funnelBreakdown(actor.id, actor.role),
      ]);
      return { summary, funnel, breakdown };
    }),
};

const getEarningsTool: AiTool = {
  name: "get_earnings",
  description: "Load the creator's internal ledger (pending, earned, voided). Not a payment provider.",
  roles: ["CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "Load earnings ledger",
  execute: (actor) => wrap(() => earningsFor(actor.id)),
};

const listMyApplicationsTool: AiTool = {
  name: "list_my_applications",
  description: "List this creator's applications and invites.",
  roles: ["CREATOR"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "List my applications",
  execute: (actor) => wrap(async () => ({ applications: await listApplicationsForCreator(actor.id) })),
};

const searchCreatorsTool: AiTool = {
  name: "search_creators",
  description:
    "Natural-language search over onboarded creator cards using stored text and embeddings. Returns reasons from real fields only.",
  roles: ["BRAND"],
  kind: "read",
  input: z.object({ query: z.string().trim().min(3).max(500) }),
  parameters: objectParams({ query: str("What kind of creator you need") }, ["query"]),
  summary: (args) => `Search creators: ${args.query}`,
  execute: (_actor, args) => wrap(() => searchCreatorsByQuery(String(args.query))),
};

const listCreatorsTool: AiTool = {
  name: "list_creators",
  description: "List onboarded creator cards in the marketplace.",
  roles: ["BRAND"],
  kind: "read",
  input: z.object({}),
  parameters: objectParams({}),
  summary: () => "List marketplace creators",
  execute: () => wrap(async () => ({ creators: await listMarketplaceCreators() })),
};

const getCreatorTool: AiTool = {
  name: "get_creator",
  description: "Load one onboarded creator card. Does not record a profile-view event.",
  roles: ["BRAND"],
  kind: "read",
  input: z.object({ creatorId: idField }),
  parameters: objectParams({ creatorId: str("Creator profile id") }, ["creatorId"]),
  summary: (args) => `Load creator ${args.creatorId}`,
  execute: (_actor, args) => wrap(() => getMarketplaceCreator(String(args.creatorId))),
};

const getMatchesTool: AiTool = {
  name: "get_campaign_matches",
  description: "Rank onboarded creators for a campaign using stored fields and embeddings, with transparent reasons.",
  roles: ["BRAND"],
  kind: "read",
  input: z.object({ campaignId: idField }),
  parameters: objectParams({ campaignId: str("Campaign id") }, ["campaignId"]),
  summary: (args) => `Rank creators for campaign ${args.campaignId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const campaign = await getCampaign(String(args.campaignId));
      if (String(campaign.brandUserId) !== actor.id) throw new Error("Not your campaign");
      return { matches: await rankCreatorsForCampaign(campaign) };
    }),
};

const listCampaignApplicationsTool: AiTool = {
  name: "list_campaign_applications",
  description: "List applications and invites on one of this brand's campaigns.",
  roles: ["BRAND"],
  kind: "read",
  input: z.object({ campaignId: idField }),
  parameters: objectParams({ campaignId: str("Campaign id") }, ["campaignId"]),
  summary: (args) => `List applications for ${args.campaignId}`,
  execute: (actor, args) =>
    wrap(async () => ({
      applications: await listApplicationsForCampaign(actor.id, String(args.campaignId)),
    })),
};

const draftCampaignTool: AiTool = {
  name: "draft_campaign",
  description: "Draft campaign fields from company intelligence and an intent. Does not save until create_campaign is confirmed.",
  roles: ["BRAND"],
  kind: "draft",
  input: z.object({ intent: z.string().trim().min(8).max(4000) }),
  parameters: objectParams({ intent: str("What the campaign is for") }, ["intent"]),
  summary: (args) => `Draft campaign: ${String(args.intent).slice(0, 80)}`,
  execute: (actor, args) => wrap(() => draftCampaignFromIntent(actor, String(args.intent))),
};

const draftApplicationTool: AiTool = {
  name: "draft_application",
  description: "Draft an application pitch from the creator card and campaign. Does not submit.",
  roles: ["CREATOR"],
  kind: "draft",
  input: z.object({ campaignId: idField }),
  parameters: objectParams({ campaignId: str("Campaign id") }, ["campaignId"]),
  summary: (args) => `Draft application for ${args.campaignId}`,
  execute: (actor, args) => wrap(() => draftApplicationForCampaign(actor, String(args.campaignId))),
};

const draftInvitationTool: AiTool = {
  name: "draft_invitation",
  description: "Draft invitation copy for a creator and campaign. Does not send.",
  roles: ["BRAND"],
  kind: "draft",
  input: z.object({ creatorId: idField, campaignId: idField }),
  parameters: objectParams(
    { creatorId: str("Creator profile id"), campaignId: str("Campaign id") },
    ["creatorId", "campaignId"],
  ),
  summary: (args) => `Draft invite for ${args.creatorId}`,
  execute: (actor, args) =>
    wrap(() => draftInvitationMessage(actor, String(args.creatorId), String(args.campaignId))),
};

const draftReplyTool: AiTool = {
  name: "draft_reply",
  description: "Draft a reply to a collaboration thread. Does not send.",
  roles: ["BRAND", "CREATOR"],
  kind: "draft",
  input: z.object({
    collaborationId: idField,
    instruction: z.string().trim().min(3).max(2000),
  }),
  parameters: objectParams(
    {
      collaborationId: str("Collaboration id"),
      instruction: str("What the reply should accomplish"),
    },
    ["collaborationId", "instruction"],
  ),
  summary: (args) => `Draft reply for ${args.collaborationId}`,
  execute: (actor, args) =>
    wrap(() => draftCollaborationReply(actor, String(args.collaborationId), String(args.instruction))),
};

const createCampaignTool: AiTool = {
  name: "create_campaign",
  description: "Create and publish a campaign. Requires user confirmation.",
  roles: ["BRAND"],
  kind: "write",
  input: createCampaignSchema,
  parameters: objectParams(
    {
      title: str("Title"),
      description: str("Brief"),
      goal: str("Goal"),
      targetAudience: str("Audience"),
      industry: str("Industry"),
      pricePerPost: { type: "number", description: "Optional rate" },
      deliverables: str("Optional deliverables"),
      requirements: str("Optional requirements"),
    },
    ["title", "description", "goal", "targetAudience", "industry"],
  ),
  summary: (args) => `Create campaign “${args.title ?? ""}”`,
  execute: (actor, args) =>
    wrap(async () => {
      const input = createCampaignSchema.parse(args);
      const campaign = await createCampaign(actor.id, input);
      return { campaign: serializeCampaign(campaign, await brandName(actor.id)) };
    }),
};

const applyToCampaignTool: AiTool = {
  name: "apply_to_campaign",
  description: "Submit an application. Requires user confirmation.",
  roles: ["CREATOR"],
  kind: "write",
  input: z.object({ campaignId: idField, pitch: z.string().trim().min(10).max(4000) }),
  parameters: objectParams(
    { campaignId: str("Campaign id"), pitch: str("Application pitch") },
    ["campaignId", "pitch"],
  ),
  summary: (args) => `Apply to campaign ${args.campaignId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const application = await applyToCampaign(actor.id, String(args.campaignId), String(args.pitch));
      return { application: { id: String(application._id), status: application.status } };
    }),
};

const acceptInviteTool: AiTool = {
  name: "accept_invite",
  description: "Accept a brand invite. Requires user confirmation.",
  roles: ["CREATOR"],
  kind: "write",
  input: z.object({ applicationId: idField }),
  parameters: objectParams({ applicationId: str("Application id") }, ["applicationId"]),
  summary: (args) => `Accept invite ${args.applicationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const result = await acceptInvite(actor.id, String(args.applicationId));
      return {
        applicationId: String(result.application._id),
        collaboration: await serializeCollaboration(result.collaboration),
      };
    }),
};

const inviteCreatorTool: AiTool = {
  name: "invite_creator",
  description:
    "Invite a creator to a campaign. Pass creatorUserId (matches.userId), not the profile creatorId. Requires user confirmation.",
  roles: ["BRAND"],
  kind: "write",
  input: z.object({ campaignId: idField, creatorUserId: idField }),
  parameters: objectParams(
    { campaignId: str("Campaign id"), creatorUserId: str("Creator user id") },
    ["campaignId", "creatorUserId"],
  ),
  summary: (args) => `Invite creator ${args.creatorUserId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const result = await inviteCreator(actor.id, String(args.campaignId), String(args.creatorUserId));
      return {
        application: { id: String(result.application._id), status: result.application.status },
        collaboration: result.collaboration ? await serializeCollaboration(result.collaboration) : null,
      };
    }),
};

const acceptApplicationTool: AiTool = {
  name: "accept_application",
  description: "Accept a submitted application and open a collaboration. Requires user confirmation.",
  roles: ["BRAND"],
  kind: "write",
  input: z.object({ applicationId: idField }),
  parameters: objectParams({ applicationId: str("Application id") }, ["applicationId"]),
  summary: (args) => `Accept application ${args.applicationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const result = await acceptApplication(actor.id, String(args.applicationId));
      return {
        applicationId: String(result.application._id),
        collaboration: await serializeCollaboration(result.collaboration),
      };
    }),
};

const rejectApplicationTool: AiTool = {
  name: "reject_application",
  description: "Reject a submitted application or invite. Requires user confirmation.",
  roles: ["BRAND"],
  kind: "write",
  input: z.object({ applicationId: idField }),
  parameters: objectParams({ applicationId: str("Application id") }, ["applicationId"]),
  summary: (args) => `Reject application ${args.applicationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const application = await rejectApplication(actor.id, String(args.applicationId));
      return { applicationId: String(application._id), status: application.status };
    }),
};

const sendMessageTool: AiTool = {
  name: "send_message",
  description: "Send a message on a collaboration thread. Requires user confirmation.",
  roles: ["BRAND", "CREATOR"],
  kind: "write",
  input: z.object({ collaborationId: idField, body: z.string().trim().min(1).max(8000) }),
  parameters: objectParams(
    { collaborationId: str("Collaboration id"), body: str("Message body") },
    ["collaborationId", "body"],
  ),
  summary: (args) => `Send a message on ${args.collaborationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const message = await sendMessage(String(args.collaborationId), actor.id, String(args.body));
      return { message: { id: String(message._id), body: message.body } };
    }),
};

const updateMyProfileTool: AiTool = {
  name: "update_my_profile",
  description: "Update creator card copy without re-fetching public profiles. Requires user confirmation.",
  roles: ["CREATOR"],
  kind: "write",
  input: z.object({
    linkedInUrl: z.string().url().optional(),
    xUrl: z.string().url().optional(),
    headline: z.string().max(180).optional(),
    bio: z.string().max(4000).optional(),
    positioning: z.string().max(500).optional(),
  }),
  parameters: objectParams({
    headline: str("Headline"),
    bio: str("Card copy"),
    positioning: str("Positioning"),
  }),
  summary: () => "Update my creator card",
  execute: (actor, args) =>
    wrap(async () => {
      const existing = await getCreatorForUser(actor.id);
      if (!existing) throw new Error("Create a creator profile first");
      const profile = await upsertCreator(actor.id, {
        linkedInUrl: args.linkedInUrl ? String(args.linkedInUrl) : undefined,
        xUrl: args.xUrl ? String(args.xUrl) : undefined,
        headline: args.headline != null ? String(args.headline) : undefined,
        bio: args.bio != null ? String(args.bio) : undefined,
        positioning: args.positioning != null ? String(args.positioning) : undefined,
        refetch: false,
      });
      return { profile: serializeCreator(profile, actor.name) };
    }),
};

const transitionCollaborationTool: AiTool = {
  name: "transition_collaboration",
  description:
    "Move a collaboration to the next status (submit content, approve, publish, complete, or cancel). Requires user confirmation.",
  roles: ["BRAND", "CREATOR"],
  kind: "write",
  input: z.object({
    collaborationId: idField,
    status: z.enum(COLLABORATION_STATUSES),
    contentUrl: z.string().url().optional(),
    publishedUrl: z.string().url().optional(),
    contentNotes: z.string().max(4000).optional(),
  }),
  parameters: objectParams(
    {
      collaborationId: str("Collaboration id"),
      status: str("Next status"),
      contentUrl: str("Draft or content URL"),
      publishedUrl: str("Published LinkedIn post URL"),
    },
    ["collaborationId", "status"],
  ),
  summary: (args) => `Move collaboration to ${args.status}`,
  execute: (actor, args) =>
    wrap(async () => {
      const item = await transitionCollaboration(
        actor.id,
        actor.role,
        String(args.collaborationId),
        args.status as CollaborationStatus,
        {
          contentUrl: args.contentUrl ? String(args.contentUrl) : undefined,
          publishedUrl: args.publishedUrl ? String(args.publishedUrl) : undefined,
          contentNotes: args.contentNotes ? String(args.contentNotes) : undefined,
        },
      );
      return { collaboration: await serializeCollaboration(item) };
    }),
};

const recordFunnelTool: AiTool = {
  name: "record_funnel",
  description:
    "Record a real lead, pipeline, or revenue event on a collaboration. Brand only. Requires confirmation. Do not invent amounts.",
  roles: ["BRAND"],
  kind: "write",
  input: z.object({
    collaborationId: idField,
    type: z.enum(FUNNEL_EVENT_TYPES),
    amount: z.number().optional(),
    note: z.string().max(400).optional(),
  }),
  parameters: objectParams(
    {
      collaborationId: str("Collaboration id"),
      type: str("LEAD, PIPELINE, or REVENUE"),
    },
    ["collaborationId", "type"],
  ),
  summary: (args) => `Record ${args.type} on ${args.collaborationId}`,
  execute: (actor, args) =>
    wrap(async () => {
      const collaboration = await getCollaborationForUser(String(args.collaborationId), actor.id);
      if (args.type === "REVENUE" && (args.amount === undefined || Number.isNaN(Number(args.amount)))) {
        throw new Error("Revenue needs a recorded amount");
      }
      const tracking = await TrackingLink.findOne({ collaborationId: collaboration._id });
      await recordEvent({
        type: String(args.type) as "LEAD" | "PIPELINE" | "REVENUE",
        actorUserId: actor.id,
        campaignId: collaboration.campaignId,
        creatorUserId: collaboration.creatorUserId,
        collaborationId: collaboration._id,
        trackingLinkId: tracking?._id,
        metadata: { amount: args.amount, note: args.note, postLabel: tracking?.postLabel },
      });
      return { ok: true };
    }),
};

const tools: AiTool[] = [
  getMyProfile,
  getCampaignTool,
  listCampaignsTool,
  getCollaborationTool,
  listCollaborationsTool,
  getMessagesTool,
  getAnalyticsTool,
  getEarningsTool,
  listMyApplicationsTool,
  searchCreatorsTool,
  listCreatorsTool,
  getCreatorTool,
  getMatchesTool,
  listCampaignApplicationsTool,
  draftCampaignTool,
  draftApplicationTool,
  draftInvitationTool,
  draftReplyTool,
  createCampaignTool,
  applyToCampaignTool,
  acceptInviteTool,
  inviteCreatorTool,
  acceptApplicationTool,
  rejectApplicationTool,
  sendMessageTool,
  transitionCollaborationTool,
  recordFunnelTool,
  updateMyProfileTool,
];

export function toolsFor(role: AiActor["role"]) {
  return tools.filter((tool) => tool.roles.includes(role));
}

export function getTool(name: string, role: AiActor["role"]) {
  return toolsFor(role).find((tool) => tool.name === name);
}

export function parseToolArgs(tool: AiTool, raw: unknown): ToolArgs {
  return tool.input.parse(raw);
}
