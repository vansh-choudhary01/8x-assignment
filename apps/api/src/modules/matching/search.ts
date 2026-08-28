import { embedTexts, hasOpenAI } from "../../infrastructure/ai/openai.ts";
import { User } from "../users/user.model.ts";
import { getOnboardedCreatorDocs } from "../creators/marketplace.service.ts";
import { cosine } from "./cosine.ts";

function haystack(parts: Array<string | string[] | undefined>) {
  return parts
    .flatMap((part) => (Array.isArray(part) ? part : part ? [part] : []))
    .join(" ")
    .toLowerCase();
}

export async function searchCreatorsByQuery(query: string, limit = 12) {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { query: trimmed, matches: [], note: "Query is too short to search stored creator cards." };
  }

  const creators = await getOnboardedCreatorDocs();
  if (!creators.length) {
    return {
      query: trimmed,
      matches: [],
      note: "No onboarded creators are stored yet.",
    };
  }

  const users = await User.find({ _id: { $in: creators.map((item) => item.userId) } });
  const names = new Map(users.map((user) => [String(user._id), user.name]));

  let queryEmbedding: number[] | undefined;
  let embeddingNote = "Semantic ranking skipped (no embedding or OPENAI_API_KEY).";
  if (hasOpenAI()) {
    try {
      queryEmbedding = (await embedTexts([trimmed]))[0];
      embeddingNote = "Semantic ranking used stored creator embeddings vs the query embedding.";
    } catch {
      embeddingNote = "Embedding the query failed. Ranking used only text overlap on stored fields.";
    }
  }

  const STOP = new Set([
    "the", "and", "for", "who", "that", "our", "have", "with", "about", "from", "this",
    "they", "them", "their", "looks", "look", "relevant", "find", "me", "want", "need",
  ]);
  const tokens = trimmed
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 3 && !STOP.has(token));

  const matches = creators
    .map((creator) => {
      const name = creator.publicName || names.get(String(creator.userId)) || "Creator";
      const text = haystack([
        name,
        creator.headline,
        creator.bio,
        creator.positioning,
        creator.audienceSummary,
        creator.industries,
        creator.topics,
        creator.insights?.expertise,
        creator.insights?.contentTopics,
        creator.insights?.contentThemes,
        creator.insights?.creatorCategory,
        creator.insights?.audienceType,
        creator.insights?.cardCopy,
      ]);
      const hits = tokens.filter((token) => text.includes(token));
      const semantic = cosine(queryEmbedding, creator.embedding);
      const score = Math.min(1, hits.length * 0.12 + semantic * 0.7);
      const reasons: string[] = [];
      if (hits.length) reasons.push(`Query terms present on the stored card: ${hits.slice(0, 8).join(", ")}`);
      if (semantic > 0.12) reasons.push(`Embedding similarity ${semantic.toFixed(2)} against the stored card vector`);
      if (creator.insights?.creatorCategory) reasons.push(`Stored category: ${creator.insights.creatorCategory}`);
      if (!reasons.length) reasons.push("Onboarded creator with no overlap on this query.");
      return {
        creatorId: String(creator._id),
        userId: String(creator.userId),
        name,
        headline: creator.headline || creator.publicTitle || "",
        industries: creator.industries,
        topics: creator.topics,
        audienceType: creator.insights?.audienceType || creator.audienceSummary || "",
        score: Number(score.toFixed(3)),
        reasons,
      };
    })
    .filter((item) => item.score > 0 || item.reasons[0]?.startsWith("Query terms"))
    .sort((a, b) => b.score - a.score);

  const withSignal = matches.filter((item) => item.score > 0).slice(0, limit);
  return {
    query: trimmed,
    note: withSignal.length
      ? embeddingNote
      : "No stored creator cards overlapped this query.",
    matches: withSignal,
  };
}
