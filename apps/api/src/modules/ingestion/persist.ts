import { chunkText } from "./chunk.ts";
import { DocumentChunk } from "./documentChunk.model.ts";
import { SourceDocument } from "./sourceDocument.model.ts";
import { embedTexts, hasOpenAI } from "../../infrastructure/ai/openai.ts";
import type { Types } from "mongoose";

export async function persistSourceWithChunks(input: {
  ownerUserId: Types.ObjectId | string;
  kind: "WEBSITE_PAGE" | "CREATOR_PROFILE";
  url: string;
  title?: string;
  text: string;
  httpStatus?: number;
}): Promise<{ documentId: string; chunkCount: number; embedded: boolean }> {
  if (input.kind === "CREATOR_PROFILE") {
    await dropOtherCreatorSources(input.ownerUserId, input.url);
  }

  const doc = await SourceDocument.findOneAndUpdate(
    { ownerUserId: input.ownerUserId, url: input.url },
    {
      ownerUserId: input.ownerUserId,
      kind: input.kind,
      url: input.url,
      title: input.title,
      extractedText: input.text,
      httpStatus: input.httpStatus,
      fetchedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await DocumentChunk.deleteMany({ documentId: doc._id });
  const pieces = chunkText(input.text);
  if (pieces.length === 0) {
    return { documentId: String(doc._id), chunkCount: 0, embedded: false };
  }

  let embeddings: number[][] = [];
  let embedded = false;
  if (hasOpenAI()) {
    embeddings = await embedTexts(pieces);
    embedded = embeddings.length === pieces.length;
  }

  await DocumentChunk.insertMany(
    pieces.map((text, ordinal) => ({
      documentId: doc._id,
      ownerUserId: input.ownerUserId,
      ordinal,
      text,
      embedding: embedded ? embeddings[ordinal] : undefined,
    })),
  );

  return { documentId: String(doc._id), chunkCount: pieces.length, embedded };
}

/** Drop leftover creator sources from a previous LinkedIn URL for this user. */
export async function dropOtherCreatorSources(
  ownerUserId: Types.ObjectId | string,
  keepUrl?: string,
): Promise<void> {
  const stale = await SourceDocument.find({
    ownerUserId,
    kind: "CREATOR_PROFILE",
    ...(keepUrl ? { url: { $ne: keepUrl } } : {}),
  }).select("_id");
  const ids = stale.map((doc) => doc._id);
  if (!ids.length) return;
  await DocumentChunk.deleteMany({ documentId: { $in: ids } });
  await SourceDocument.deleteMany({ _id: { $in: ids } });
}
