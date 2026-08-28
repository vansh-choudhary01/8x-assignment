import { BrandProfile } from "../brands/brandProfile.model.ts";
import { Campaign } from "../campaigns/campaign.model.ts";
import { Collaboration } from "../collaborations/collaboration.model.ts";
import { newTrackingToken, TrackingLink } from "./trackingLink.model.ts";

export async function ensureTrackingLink(
  collaboration: InstanceType<typeof Collaboration>,
  destinationUrl?: string,
  postLabel?: string,
) {
  let dest = destinationUrl?.trim();
  if (!dest) {
    const campaign = await Campaign.findById(collaboration.campaignId);
    dest = campaign?.landingUrl?.trim();
    if (!dest) {
      const brand = await BrandProfile.findOne({ userId: collaboration.brandUserId });
      dest = brand?.websiteUrl?.trim();
    }
  }
  if (!dest) return null;

  const existing = await TrackingLink.findOne({ collaborationId: collaboration._id });
  if (existing) {
    if (postLabel) existing.postLabel = postLabel;
    await existing.save();
    return existing;
  }
  return TrackingLink.create({
    token: newTrackingToken(),
    collaborationId: collaboration._id,
    campaignId: collaboration.campaignId,
    creatorUserId: collaboration.creatorUserId,
    brandUserId: collaboration.brandUserId,
    destinationUrl: dest,
    postLabel: postLabel || "LinkedIn post",
  });
}
