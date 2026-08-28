import { errors } from "../../common/errors.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { User } from "../users/user.model.ts";
import { serializeCreator } from "./creator.service.ts";
import { CreatorProfile } from "./creatorProfile.model.ts";

export async function listMarketplaceCreators() {
  const profiles = await CreatorProfile.find({ onboardingCompletedAt: { $ne: null } }).sort({ updatedAt: -1 });
  const users = await User.find({ _id: { $in: profiles.map((p) => p.userId) } });
  const names = new Map(users.map((u) => [String(u._id), u.name]));
  return profiles.map((profile) => serializeCreator(profile, names.get(String(profile.userId)) ?? "Creator"));
}

export async function getMarketplaceCreator(id: string, actorUserId?: string, recordView = false) {
  const profile = await CreatorProfile.findById(id);
  if (!profile || !profile.onboardingCompletedAt) throw errors.notFound("Creator not found");
  const user = await User.findById(profile.userId);
  if (recordView && actorUserId) {
    await recordEvent({
      type: "CREATOR_PROFILE_VIEW",
      actorUserId,
      creatorUserId: profile.userId,
      metadata: { creatorProfileId: String(profile._id) },
    });
  }
  return serializeCreator(profile, user?.name ?? "Creator");
}

export async function getOnboardedCreatorDocs() {
  return CreatorProfile.find({ onboardingCompletedAt: { $ne: null } });
}
