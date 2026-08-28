import { CAMPAIGN_STATUSES_ACCEPTING_APPLICATIONS } from "@naano/shared";
import { z } from "zod";
import { errors } from "../../common/errors.ts";
import { ensureTrackingLink } from "../analytics/ensureTrackingLink.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { Campaign } from "../campaigns/campaign.model.ts";
import { Collaboration } from "../collaborations/collaboration.model.ts";
import { Conversation } from "../messaging/message.model.ts";
import { LedgerEntry } from "../earnings/ledgerEntry.model.ts";
import { CreatorProfile } from "../creators/creatorProfile.model.ts";
import { User } from "../users/user.model.ts";
import { Application } from "./application.model.ts";

export const applySchema = z.object({
  pitch: z.string().trim().min(10).max(4000),
});

type ApplicationExtras = {
  campaignTitle?: string;
  collaborationId?: string | null;
  creatorName?: string;
};

export function serializeApplication(
  application: InstanceType<typeof Application>,
  extras: ApplicationExtras = {},
) {
  return {
    id: String(application._id),
    campaignId: String(application.campaignId),
    creatorUserId: String(application.creatorUserId),
    brandUserId: String(application.brandUserId),
    pitch: application.pitch,
    status: application.status,
    decidedAt: application.decidedAt ?? null,
    createdAt: application.createdAt,
    ...extras,
  };
}

export async function applyToCampaign(creatorUserId: string, campaignId: string, pitch: string) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw errors.notFound("Campaign not found");
  if (
    !(CAMPAIGN_STATUSES_ACCEPTING_APPLICATIONS as readonly string[]).includes(campaign.status)
  ) {
    throw errors.badRequest("This campaign is not accepting applications");
  }
  const creatorProfile = await CreatorProfile.findOne({
    userId: creatorUserId,
    onboardingCompletedAt: { $ne: null },
  });
  if (!creatorProfile) throw errors.badRequest("Finish creator onboarding before applying");
  const existing = await Application.findOne({ campaignId, creatorUserId });
  if (existing) throw errors.conflict("You already applied to this campaign");
  const application = await Application.create({
    campaignId,
    creatorUserId,
    brandUserId: campaign.brandUserId,
    pitch,
    status: "SUBMITTED",
  });
  await recordEvent({
    type: "APPLICATION_SUBMITTED",
    actorUserId: creatorUserId,
    campaignId,
    creatorUserId,
    metadata: { applicationId: String(application._id) },
  });
  return application;
}

export async function inviteCreator(brandUserId: string, campaignId: string, creatorUserId: string) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign || String(campaign.brandUserId) !== brandUserId) {
    throw errors.notFound("Campaign not found");
  }
  if (
    !(CAMPAIGN_STATUSES_ACCEPTING_APPLICATIONS as readonly string[]).includes(campaign.status)
  ) {
    throw errors.badRequest("This campaign is not accepting invitations");
  }
  const creator = await User.findById(creatorUserId);
  if (!creator || creator.role !== "CREATOR") throw errors.notFound("Creator not found");
  const creatorProfile = await CreatorProfile.findOne({
    userId: creatorUserId,
    onboardingCompletedAt: { $ne: null },
  });
  if (!creatorProfile) throw errors.notFound("Creator not found");
  const existing = await Application.findOne({ campaignId, creatorUserId });
  if (existing) {
    if (existing.status === "ACCEPTED") {
      const collaboration = await Collaboration.findOne({ applicationId: existing._id });
      return { application: existing, collaboration };
    }
    if (existing.status === "INVITED" || existing.status === "SUBMITTED") {
      return { application: existing, collaboration: null };
    }
    throw errors.conflict("This creator already has a closed application on this campaign");
  }
  const application = await Application.create({
    campaignId,
    creatorUserId,
    brandUserId,
    pitch: "Invited by the brand",
    status: "INVITED",
  });
  await recordEvent({
    type: "OUTREACH_SENT",
    actorUserId: brandUserId,
    campaignId,
    creatorUserId,
    metadata: { applicationId: String(application._id), source: "invite" },
  });
  return { application, collaboration: null };
}

export async function acceptInvite(creatorUserId: string, applicationId: string) {
  const application = await Application.findById(applicationId);
  if (!application || String(application.creatorUserId) !== creatorUserId) {
    throw errors.notFound("Invitation not found");
  }
  if (application.status !== "INVITED") {
    throw errors.badRequest("This invitation is no longer open");
  }
  return openCollaboration(application, creatorUserId);
}

async function amountFor(campaign: InstanceType<typeof Campaign>, creatorUserId: string) {
  if (campaign.pricePerPost && campaign.pricePerPost > 0) return campaign.pricePerPost;
  const profile = await CreatorProfile.findOne({ userId: creatorUserId });
  return profile?.pricePerPost && profile.pricePerPost > 0 ? profile.pricePerPost : 0;
}

export async function acceptApplication(brandUserId: string, applicationId: string) {
  const application = await Application.findById(applicationId);
  if (!application || String(application.brandUserId) !== brandUserId) {
    throw errors.notFound("Application not found");
  }
  if (application.status === "ACCEPTED") {
    const existing = await Collaboration.findOne({ applicationId: application._id });
    if (existing) return { application, collaboration: existing };
  }
  if (application.status !== "SUBMITTED") {
    throw errors.badRequest("Only submitted applications can be accepted");
  }
  return openCollaboration(application, brandUserId);
}

async function openCollaboration(
  application: InstanceType<typeof Application>,
  actorUserId: string,
) {
  const campaign = await Campaign.findById(application.campaignId);
  if (!campaign) throw errors.notFound("Campaign not found");

  application.status = "ACCEPTED";
  application.decidedAt = new Date();
  await application.save();

  const amount = await amountFor(campaign, String(application.creatorUserId));
  const collaboration = await Collaboration.create({
    applicationId: application._id,
    campaignId: campaign._id,
    brandUserId: application.brandUserId,
    creatorUserId: application.creatorUserId,
    status: "ACCEPTED",
    amount,
    currency: campaign.currency,
  });
  await Conversation.create({
    collaborationId: collaboration._id,
    brandUserId: application.brandUserId,
    creatorUserId: application.creatorUserId,
  });
  await LedgerEntry.create({
    creatorUserId: application.creatorUserId,
    collaborationId: collaboration._id,
    type: "PENDING",
    amount,
    currency: campaign.currency,
    note: "Held when the application was accepted",
  });
  if (campaign.status === "OPEN") {
    campaign.status = "IN_PROGRESS";
    await campaign.save();
  }
  await recordEvent({
    type: "APPLICATION_ACCEPTED",
    actorUserId,
    campaignId: campaign._id,
    creatorUserId: application.creatorUserId,
    collaborationId: collaboration._id,
  });
  await ensureTrackingLink(collaboration);
  return { application, collaboration };
}

export async function rejectApplication(brandUserId: string, applicationId: string) {
  const application = await Application.findById(applicationId);
  if (!application || String(application.brandUserId) !== brandUserId) {
    throw errors.notFound("Application not found");
  }
  if (application.status !== "SUBMITTED" && application.status !== "INVITED") {
    throw errors.badRequest("Only open applications can be rejected");
  }
  application.status = "REJECTED";
  application.decidedAt = new Date();
  await application.save();
  await recordEvent({
    type: "APPLICATION_REJECTED",
    actorUserId: brandUserId,
    campaignId: application.campaignId,
    creatorUserId: application.creatorUserId,
  });
  return application;
}

export async function listApplicationsForCreator(creatorUserId: string) {
  const items = await Application.find({ creatorUserId }).sort({ createdAt: -1 });
  const campaigns = await Campaign.find({ _id: { $in: items.map((i) => i.campaignId) } });
  const titles = new Map(campaigns.map((c) => [String(c._id), c.title]));
  const collabs = await Collaboration.find({ applicationId: { $in: items.map((i) => i._id) } });
  const collabByApp = new Map(collabs.map((c) => [String(c.applicationId), String(c._id)]));
  return items.map((item) =>
    serializeApplication(item, {
      campaignTitle: titles.get(String(item.campaignId)) ?? "",
      collaborationId: collabByApp.get(String(item._id)) ?? null,
    }),
  );
}

export async function listApplicationsForCampaign(brandUserId: string, campaignId: string) {
  const items = await Application.find({
    campaignId,
    brandUserId,
  }).sort({ createdAt: -1 });
  const users = await User.find({ _id: { $in: items.map((i) => i.creatorUserId) } });
  const profiles = await CreatorProfile.find({ userId: { $in: items.map((i) => i.creatorUserId) } });
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  const publicNames = new Map(profiles.map((p) => [String(p.userId), p.publicName]));
  const collabs = await Collaboration.find({ applicationId: { $in: items.map((i) => i._id) } });
  const collabByApp = new Map(collabs.map((c) => [String(c.applicationId), String(c._id)]));
  return items.map((item) =>
    serializeApplication(item, {
      creatorName: publicNames.get(String(item.creatorUserId)) || names.get(String(item.creatorUserId)) || "",
      collaborationId: collabByApp.get(String(item._id)) ?? null,
    }),
  );
}
