import mongoose, { Schema, type Types } from "mongoose";

export type SourceDocumentDoc = {
  ownerUserId: Types.ObjectId;
  kind: "WEBSITE_PAGE" | "CREATOR_PROFILE";
  url: string;
  title?: string;
  extractedText: string;
  httpStatus?: number;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const sourceDocumentSchema = new Schema<SourceDocumentDoc>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, required: true, enum: ["WEBSITE_PAGE", "CREATOR_PROFILE"] },
    url: { type: String, required: true },
    title: String,
    extractedText: { type: String, required: true },
    httpStatus: Number,
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

sourceDocumentSchema.index({ ownerUserId: 1, url: 1 }, { unique: true });

export const SourceDocument = mongoose.model<SourceDocumentDoc>(
  "SourceDocument",
  sourceDocumentSchema,
);
