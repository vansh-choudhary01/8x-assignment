import { User } from "../users/user.model.ts";
import { getOnboardedCreatorDocs } from "../creators/marketplace.service.ts";
import type { CampaignDoc } from "../campaigns/campaign.model.ts";
import { cosine } from "./cosine.ts";

function overlap(a: string[], b: string[]): string[] {
  const set = new Set(a.map((item) => item.toLowerCase()));
  return b.filter((item) => set.has(item.toLowerCase()));
}

export async function rankCreatorsForCampaign(campaign: CampaignDoc) {
  const creators = await getOnboardedCreatorDocs();
  const users = await User.find({
    _id: { $in: creators.map((item) => item.userId) },
  });
  const names = new Map(users.map((user) => [String(user._id), user.name]));

  return creators
    .map((creator) => {
      const industryHits = overlap(creator.industries, [campaign.industry, ...creator.insights?.industries ?? []]);
      const topicHits = overlap(creator.topics, campaign.description.split(/\W+/).filter((w) => w.length > 4));
      const insightTopics = overlap(creator.insights?.contentTopics ?? [], [
        campaign.industry,
        campaign.goal,
        ...campaign.description.split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
      ]);
      const industryScore = industryHits.length || creator.industries.some((i) =>
        campaign.industry.toLowerCase().includes(i.toLowerCase()) ||
        i.toLowerCase().includes(campaign.industry.toLowerCase()),
      )
        ? 0.35
        : 0;
      const topicScore = topicHits.length || insightTopics.length ? 0.25 : 0;
      const audienceScore =
        creator.insights?.audienceType &&
        campaign.targetAudience &&
        creator.insights.audienceType.toLowerCase().includes(campaign.targetAudience.split(" ")[0]?.toLowerCase() ?? "")
          ? 0.15
          : creator.audienceSummary
            ? 0.05
            : 0;
      const priceScore =
        campaign.pricePerPost && creator.pricePerPost
          ? creator.pricePerPost <= campaign.pricePerPost * 1.15
            ? 0.1
            : 0
          : 0.05;
      const semantic = cosine(campaign.embedding, creator.embedding) * 0.25;
      const score = Math.min(1, industryScore + topicScore + audienceScore + priceScore + semantic);
      const reasons: string[] = [];
      if (industryHits.length) reasons.push(`Industry overlap: ${industryHits.join(", ")}`);
      else if (industryScore) reasons.push(`Industry related to ${campaign.industry}`);
      if (topicHits.length) reasons.push(`Topics in common with the brief: ${topicHits.slice(0, 4).join(", ")}`);
      if (insightTopics.length) reasons.push(`AI topics: ${insightTopics.slice(0, 4).join(", ")}`);
      if (semantic > 0.12) reasons.push(`Semantic similarity ${(semantic / 0.25).toFixed(2)} from stored embeddings`);
      if (creator.pricePerPost && campaign.pricePerPost) {
        reasons.push(
          creator.pricePerPost <= campaign.pricePerPost
            ? `Price (${creator.currency} ${creator.pricePerPost}) fits the campaign rate`
            : `Price (${creator.currency} ${creator.pricePerPost}) is above the campaign rate`,
        );
      }
      if (!reasons.length) reasons.push("Listed because they have a stored creator profile. No strong overlap yet.");
      return {
        creatorId: String(creator._id),
        userId: String(creator.userId),
        name: creator.publicName || names.get(String(creator.userId)) || "Creator",
        headline: creator.headline || creator.publicTitle || "",
        industries: creator.industries,
        topics: creator.topics,
        pricePerPost: creator.pricePerPost ?? null,
        currency: creator.currency,
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);
}
