import {
  COLLABORATION_STATUSES,
  type CollaborationStatus,
  type UserRole,
} from "@naano/shared";
import { errors } from "../../common/errors.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { TrackingLink } from "../analytics/trackingLink.model.ts";
import { ensureTrackingLink } from "../analytics/ensureTrackingLink.ts";
import { BrandProfile } from "../brands/brandProfile.model.ts";
import { Campaign } from "../campaigns/campaign.model.ts";
import { CreatorProfile } from "../creators/creatorProfile.model.ts";
import { LedgerEntry } from "../earnings/ledgerEntry.model.ts";
import { User } from "../users/user.model.ts";
import { Collaboration } from "./collaboration.model.ts";
import { config } from "../../config.ts";

const CREATOR_TRANSITIONS: Partial<Record<CollaborationStatus, CollaborationStatus[]>> = {
  ACCEPTED: ["CONTENT_SUBMITTED"],
  APPROVED: ["PUBLISHED"],
};

const BRAND_TRANSITIONS: Partial<Record<CollaborationStatus, CollaborationStatus[]>> = {
  CONTENT_SUBMITTED: ["APPROVED", "CANCELLED"],
  PUBLISHED: ["COMPLETED"],
  ACCEPTED: ["CANCELLED"],
};

export async function listCollaborations(userId: string, role: UserRole) {
  const filter = role === "BRAND" ? { brandUserId: userId } : { creatorUserId: userId };
  return Collaboration.find(filter).sort({ updatedAt: -1 });
}

export async function getCollaborationForUser(
  id: string,
  userId: string,
) {
  const collaboration = await Collaboration.findById(id);
  if (!collaboration) throw errors.notFound("Collaboration not found");
  if (String(collaboration.brandUserId) !== userId && String(collaboration.creatorUserId) !== userId) {
    throw errors.forbidden();
  }
  return collaboration;
}

export async function serializeCollaboration(
  collaboration: InstanceType<typeof Collaboration>,
) {
  const [campaign, brand, brandProfile, creator, creatorProfile, tracking] = await Promise.all([
    Campaign.findById(collaboration.campaignId),
    User.findById(collaboration.brandUserId),
    BrandProfile.findOne({ userId: collaboration.brandUserId }),
    User.findById(collaboration.creatorUserId),
    CreatorProfile.findOne({ userId: collaboration.creatorUserId }),
    TrackingLink.findOne({ collaborationId: collaboration._id }),
  ]);
  return {
    id: String(collaboration._id),
    campaignId: String(collaboration.campaignId),
    campaignTitle: campaign?.title ?? "",
    brandUserId: String(collaboration.brandUserId),
    creatorUserId: String(collaboration.creatorUserId),
    brandName: brandProfile?.companyName || brand?.name || "",
    creatorName: creatorProfile?.publicName || creator?.name || "",
    status: collaboration.status,
    amount: collaboration.amount,
    currency: collaboration.currency,
    contentUrl: collaboration.contentUrl ?? "",
    contentNotes: collaboration.contentNotes ?? "",
    publishedUrl: collaboration.publishedUrl ?? "",
    trackingUrl: tracking ? `${config.clientOrigin}/t/${tracking.token}` : "",
    pixelUrl: tracking ? `${config.clientOrigin}/p/${tracking.token}` : "",
    trackingToken: tracking?.token ?? "",
    createdAt: collaboration.createdAt,
    updatedAt: collaboration.updatedAt,
  };
}

export async function transitionCollaboration(
  userId: string,
  role: UserRole,
  collaborationId: string,
  status: CollaborationStatus,
  extra: { contentUrl?: string; contentNotes?: string; publishedUrl?: string },
) {
  const collaboration = await getCollaborationForUser(collaborationId, userId);
  const allowed =
    role === "CREATOR"
      ? CREATOR_TRANSITIONS[collaboration.status] ?? []
      : BRAND_TRANSITIONS[collaboration.status] ?? [];
  if (!allowed.includes(status)) {
    throw errors.badRequest(`Cannot move from ${collaboration.status} to ${status}`);
  }
  if (!COLLABORATION_STATUSES.includes(status)) {
    throw errors.badRequest("Unknown status");
  }

  collaboration.status = status;
  if (extra.contentUrl) collaboration.contentUrl = extra.contentUrl;
  if (extra.contentNotes) collaboration.contentNotes = extra.contentNotes;
  if (extra.publishedUrl) collaboration.publishedUrl = extra.publishedUrl;

  if (status === "CONTENT_SUBMITTED") {
    if (!extra.contentUrl) throw errors.badRequest("A content URL is required to submit");
    collaboration.contentUrl = extra.contentUrl;
    await recordEvent({
      type: "CONTENT_SUBMITTED",
      actorUserId: userId,
      campaignId: collaboration.campaignId,
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
    });
  }
  if (status === "APPROVED") {
    await recordEvent({
      type: "CONTENT_APPROVED",
      actorUserId: userId,
      campaignId: collaboration.campaignId,
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
    });
  }
  if (status === "PUBLISHED") {
    const dest = extra.publishedUrl || extra.contentUrl;
    if (!dest) throw errors.badRequest("A published LinkedIn post URL is required");
    collaboration.publishedUrl = dest;
    await ensureTrackingLink(collaboration, undefined, dest);
    await recordEvent({
      type: "COLLABORATION_PUBLISHED",
      actorUserId: userId,
      campaignId: collaboration.campaignId,
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
      metadata: { publishedUrl: dest },
    });
  }
  if (status === "COMPLETED") {
    await LedgerEntry.create({
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
      type: "EARNED",
      amount: collaboration.amount,
      currency: collaboration.currency,
      note: "Released when the brand marked the collaboration complete",
    });
    const campaign = await Campaign.findById(collaboration.campaignId);
    if (campaign) {
      const open = await Collaboration.countDocuments({
        campaignId: campaign._id,
        status: { $nin: ["COMPLETED", "CANCELLED"] },
      });
      if (open <= 1) {
        campaign.status = "COMPLETED";
        await campaign.save();
      }
    }
    await recordEvent({
      type: "COLLABORATION_COMPLETED",
      actorUserId: userId,
      campaignId: collaboration.campaignId,
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
    });
  }
  if (status === "CANCELLED") {
    await LedgerEntry.create({
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
      type: "VOIDED",
      amount: collaboration.amount,
      currency: collaboration.currency,
      note: "Voided because the collaboration was cancelled",
    });
  }

  await collaboration.save();
  return collaboration;
}
