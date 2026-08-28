import type { Types } from "mongoose";
import { config } from "../../config.ts";
import { completeJson, embedTexts, hasOpenAI } from "../../infrastructure/ai/openai.ts";
import { companyIntelligenceSchema } from "../ai/companyIntelligence.schema.ts";
import { persistSourceWithChunks } from "../ingestion/persist.ts";
import { getWebsiteSourceProvider } from "../ingestion/providers/index.ts";
import { BrandProfile } from "./brandProfile.model.ts";

export async function processBrandIngestion(brandProfileId: string): Promise<void> {
  const profile = await BrandProfile.findById(brandProfileId);
  if (!profile) return;

  profile.ingestionStatus = "RUNNING";
  profile.ingestionError = undefined;
  profile.ingestionNotes = [];
  profile.analysisStage = "fetching";
  await profile.save();

  let notes: string[] = [];
  let pages;
  try {
    const result = await getWebsiteSourceProvider().ingest(profile.websiteUrl);
    pages = result.pages;
    notes = result.notes;
  } catch (err) {
    profile.ingestionStatus = "FAILED";
    profile.ingestionError =
      err instanceof Error
        ? `Website fetch failed: ${err.message}`
        : "Website fetch failed unexpectedly.";
    profile.ingestionNotes = notes;
    profile.lastIngestedAt = new Date();
    await profile.save();
    return;
  }

  const usable = pages.filter((page) => page.text.length >= 40);
  profile.ingestionNotes = notes;
  profile.pageCount = usable.length;
  profile.analysisStage = "extracting";
  await profile.save();

  if (usable.length === 0) {
    profile.ingestionStatus = "FAILED";
    profile.ingestionError = notes.join(" ") || "No readable pages were returned from that website.";
    profile.chunkCount = 0;
    profile.lastIngestedAt = new Date();
    await profile.save();
    return;
  }

  let chunkCount = 0;
  let embeddedPages = 0;
  for (const page of usable) {
    const saved = await persistSourceWithChunks({
      ownerUserId: profile.userId as Types.ObjectId,
      kind: "WEBSITE_PAGE",
      url: page.url,
      title: page.title,
      text: page.text,
      httpStatus: page.httpStatus,
    });
    chunkCount += saved.chunkCount;
    if (saved.embedded) embeddedPages += 1;
  }
  profile.chunkCount = chunkCount;

  const combined = usable
    .map((page) => `URL: ${page.url}\nTitle: ${page.title ?? ""}\n${page.text}`)
    .join("\n\n---\n\n")
    .slice(0, 24_000);

  if (!profile.companyName) {
    profile.companyName = usable[0]?.title?.slice(0, 120);
  }

  if (hasOpenAI()) {
    profile.analysisStage = "analyzing";
    await profile.save();
    try {
      const raw = await completeJson(
        `You produce structured company intelligence for a LinkedIn creator marketplace.
Use only the website excerpts. Do not invent products, customers, metrics, or headcount.
Infer ICP, industry, campaign ideas, and creator requirements when the copy supports it, and list anything you could not determine in missing.
Return JSON:
companyName, whatTheyDo, productsServices[], industry, targetAudience, idealCustomerProfile,
valueProposition, campaignThemes[], campaignIdeas[], creatorCategories[], creatorRequirements[], missing[].`,
        combined,
      );
      const parsedJson: unknown = JSON.parse(raw);
      const parsed = companyIntelligenceSchema.parse(parsedJson);
      profile.intelligence = {
        ...parsed,
        generatedAt: new Date(),
        model: config.openaiModel,
      };
      if (!profile.companyName && parsed.companyName) profile.companyName = parsed.companyName.slice(0, 160);
      profile.ingestionError = undefined;
    } catch (err) {
      profile.ingestionError =
        err instanceof Error
          ? `Pages were stored (${usable.length} page(s), ${chunkCount} chunk(s)) but AI intelligence was not saved: ${err.message}`
          : "Pages were stored but AI intelligence was not saved.";
    }
  } else {
    profile.ingestionError =
      `Pages were stored (${usable.length} page(s), ${chunkCount} chunk(s)). OPENAI_API_KEY is not set, so company intelligence was not generated.`;
  }

  if (hasOpenAI()) {
    try {
      const [embedding] = await embedTexts([combined.slice(0, 8000)]);
      if (embedding) profile.embedding = embedding;
    } catch (err) {
      notes.push(
        err instanceof Error
          ? `Profile embedding failed: ${err.message}`
          : "Profile embedding failed.",
      );
      profile.ingestionNotes = notes;
    }
  }

  if (embeddedPages) {
    notes.push(`Wrote embeddings for chunks on ${embeddedPages} page(s).`);
    profile.ingestionNotes = notes;
  }

  profile.ingestionStatus = "SUCCEEDED";
  profile.analysisStage = "ready";
  profile.lastIngestedAt = new Date();
  await profile.save();
}
