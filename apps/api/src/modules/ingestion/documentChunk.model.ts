import mongoose, { Schema, type Types } from "mongoose";

export type DocumentChunkDoc = {
  documentId: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  ordinal: number;
  text: string;
  embedding?: number[];
  createdAt: Date;
};

const documentChunkSchema = new Schema<DocumentChunkDoc>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "SourceDocument", required: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ordinal: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DocumentChunk = mongoose.model<DocumentChunkDoc>(
  "DocumentChunk",
  documentChunkSchema,
);
