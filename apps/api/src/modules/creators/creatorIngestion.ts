import type { Types } from "mongoose";
import type { InsightFieldOrigin } from "@naano/shared";
import { config } from "../../config.ts";
import { completeJson, embedTexts, hasOpenAI } from "../../infrastructure/ai/openai.ts";
import { creatorInsightsSchema } from "../ai/creatorInsights.schema.ts";
import { persistSourceWithChunks, dropOtherCreatorSources } from "../ingestion/persist.ts";
import { getProfileSourceProvider } from "../ingestion/providers/index.ts";
import type { PublicProfileFields } from "../ingestion/providers/types.ts";
import { CreatorProfile, type CreatorInsights } from "./creatorProfile.model.ts";

function origin(sourced?: string | number | null, derived?: string | number | null): InsightFieldOrigin {
  if (sourced !== undefined && sourced !== null && String(sourced).trim()) return "sourced";
  if (derived !== undefined && derived !== null && String(derived).trim()) return "derived";
  return "missing";
}

function sourceBlob(fields: PublicProfileFields, fetchedText: string, title?: string, description?: string): string {
  return [
    fields.name && `Name: ${fields.name}`,
    fields.username && `X username: @${fields.username}`,
    fields.headline && `Headline: ${fields.headline}`,
    fields.about && `About: ${fields.about}`,
    fields.location && `Location: ${fields.location}`,
    fields.website && `Website: ${fields.website}`,
    fields.currentCompany && `Company: ${fields.currentCompany}`,
    fields.currentRole && `Role: ${fields.currentRole}`,
    fields.education && `Education: ${fields.education}`,
    fields.followerCountRaw && `Public followers: ${fields.followerCountRaw}`,
    fields.followerCount != null && `Parsed follower count: ${fields.followerCount}`,
    fields.articleTitles.length && `Public posts/articles: ${fields.articleTitles.join("; ")}`,
    title && `Open Graph title: ${title}`,
    description && `Open Graph description: ${description}`,
    fetchedText && `Fetched text:\n${fetchedText}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function setStage(profile: InstanceType<typeof CreatorProfile>, stage: string) {
  profile.analysisStage = stage;
  await profile.save();
}

export async function processCreatorIngestion(creatorProfileId: string): Promise<void> {
  const profile = await CreatorProfile.findById(creatorProfileId);
  if (!profile) return;

  profile.ingestionStatus = "RUNNING";
  profile.ingestionError = undefined;
  profile.analysisStage = "fetching";
  await profile.save();

  const provider = getProfileSourceProvider();
  const extraPublicUrls = profile.publicPostUrl ? [profile.publicPostUrl] : [];
  const result = await provider.ingest(profile.linkedInUrl ?? profile.xUrl ?? "", {
    extraPublicUrls,
    linkedInUrl: profile.linkedInUrl,
    xUrl: profile.xUrl,
  });
  const fields = result.fields;

  await setStage(profile, "extracting");

  profile.publicTitle = result.title;
  profile.publicDescription = result.description;
  profile.publicImageUrl = result.imageUrl;
  profile.publicName = fields.name;
  profile.publicLocation = fields.location;
  profile.currentCompany = fields.currentCompany;
  profile.currentRole = fields.currentRole;
  profile.education = fields.education;
  profile.followerCount = fields.followerCount;
  profile.followerCountRaw = fields.followerCountRaw;
  profile.connectionCountRaw = fields.connectionCountRaw;
  profile.extractedSkills = fields.skills;
  profile.publicFound = result.found;
  profile.publicMissing = result.missing;
  profile.socialSource = result.sourceKind;
  profile.xUsername = fields.username;
  if (result.sourceKind === "linkedin-public" && result.url && !profile.linkedInUrl) {
    profile.linkedInUrl = result.url;
  }
  if (result.sourceKind === "x-public" && result.url && !profile.xUrl) {
    profile.xUrl = result.url;
  }
  profile.ingestionNotes = result.notes;
  profile.lastIngestedAt = new Date();
  profile.headline = fields.headline || fields.about;
  profile.bio = fields.about;
  profile.topics = fields.topics.slice(0, 16);
  profile.insights = undefined;
  profile.embedding = undefined;
  await profile.save();

  const fetchedText = result.text?.trim() ?? "";
  const blob = sourceBlob(fields, fetchedText, result.title, result.description);
  const persistUrl = result.url || `creator:${profile.userId}`;
  const usefulFetch = !result.blocked && result.found.length > 0 && blob.length >= 40;

  if (usefulFetch) {
    await persistSourceWithChunks({
      ownerUserId: profile.userId as Types.ObjectId,
      kind: "CREATOR_PROFILE",
      url: persistUrl,
      title: result.title,
      text: blob,
      httpStatus: result.httpStatus,
    });
  } else {
    await dropOtherCreatorSources(profile.userId as Types.ObjectId);
  }
  profile.ingestionNotes = [
    ...profile.ingestionNotes,
    usefulFetch
      ? `Usable source text established (${blob.length} characters).`
      : "No usable source text was established. AI enrichment was not started.",
  ];

  if (!usefulFetch) {
    profile.ingestionStatus = "BLOCKED";
    profile.ingestionError =
      "No usable public LinkedIn or X HTML was returned. You can retry with a different public URL. If one network blocks a source, the other is still used when it returns data.";
    profile.enrichmentStatus = "IDLE";
    profile.analysisStage = "blocked";
    await profile.save();
    return;
  }

  if (!hasOpenAI()) {
    profile.ingestionStatus = "SUCCEEDED";
    profile.ingestionError = undefined;
    profile.enrichmentStatus = "SKIPPED";
    profile.ingestionNotes = [
      ...profile.ingestionNotes,
      "OPENAI_API_KEY is not set. Source text was stored without AI enrichment.",
    ];
    profile.analysisStage = "ready";
    await profile.save();
    return;
  }

  await setStage(profile, "analyzing");
  try {
    const raw = await completeJson(
        `You are building a creator marketplace card from public LinkedIn and/or public X source text.
Distinguish facts copied from the source from inferences.
Never invent follower counts, impressions, engagement, or skills that are not in the source.
You MAY infer industry, audience, positioning, creator category, content themes, and campaign ideas when name, headline, about, role, or posts support it.
If pricing cannot be grounded in a public follower/role signal, set suggestedPrice to null and confidence to "none".
If a modest recommendation is possible from role + public follower label only, use confidence "low" and explain the thin evidence in basis.
Return JSON with:
derivedHeadline (string), cardCopy (string, 2-3 sentences), positioning (string), audienceType (string, not an array), creatorCategory (string, not an array),
expertise[], industries[], contentTopics[], contentThemes[], brandCategoryFit[], campaignRecommendations[],
missing[] (fields brands would want that the source did not contain),
notes[], pricingRecommendation { suggestedPrice, currency (string like "USD", never null), basis, confidence }.`,
        blob,
      );
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = creatorInsightsSchema.parse(parsedJson);

      await setStage(profile, "writing");

      const fieldOrigins: NonNullable<CreatorInsights["fieldOrigins"]> = {
        name: origin(fields.name),
        headline: origin(fields.headline, parsed.derivedHeadline),
        about: origin(fields.about, parsed.cardCopy),
        location: origin(fields.location),
        company: origin(fields.currentCompany),
        role: origin(fields.currentRole),
        education: origin(fields.education),
        followers: origin(fields.followerCountRaw ?? fields.followerCount),
        image: origin(result.imageUrl),
        positioning: origin(undefined, parsed.positioning),
        industries: origin(undefined, parsed.industries[0]),
        audience: origin(undefined, parsed.audienceType),
      };

      profile.insights = {
        ...parsed,
        fieldOrigins,
        generatedAt: new Date(),
        model: config.openaiModel,
      };
      profile.headline = parsed.derivedHeadline || fields.headline;
      if (parsed.cardCopy) {
        profile.bio = parsed.cardCopy;
      }
      fieldOrigins.about = parsed.cardCopy ? "derived" : origin(fields.about);
      profile.positioning = parsed.positioning || profile.positioning;
      profile.audienceSummary = parsed.audienceType || profile.audienceSummary;
      profile.industries = parsed.industries.slice(0, 8);
      profile.topics = uniqueTopics(fields.topics, parsed.contentTopics);
      if (
        profile.pricePerPost == null &&
        parsed.pricingRecommendation.suggestedPrice &&
        parsed.pricingRecommendation.confidence !== "none"
      ) {
        profile.pricePerPost = parsed.pricingRecommendation.suggestedPrice;
        profile.currency = parsed.pricingRecommendation.currency || profile.currency;
      }
      profile.enrichmentStatus = "SUCCEEDED";
      profile.ingestionNotes = [
        ...profile.ingestionNotes,
        `AI enrichment ran on ${blob.length} characters of public source text.`,
      ];
    } catch {
      profile.enrichmentStatus = "FAILED";
      profile.ingestionNotes = [
        ...profile.ingestionNotes,
        "AI enrichment did not produce a usable structured card. The extracted public fields were kept.",
      ];
    }

  try {
    const [embedding] = await embedTexts([blob.slice(0, 8000)]);
    if (embedding) profile.embedding = embedding;
  } catch {
    profile.ingestionNotes = [...profile.ingestionNotes, "Profile embedding could not be stored."];
  }

  profile.ingestionStatus = "SUCCEEDED";
  profile.ingestionError = undefined;
  profile.analysisStage = "ready";
  await profile.save();
}

function uniqueTopics(sourced: string[], derived: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...sourced, ...derived]) {
    const key = item.toLowerCase();
    if (!item.trim() || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 16) break;
  }
  return out;
}
