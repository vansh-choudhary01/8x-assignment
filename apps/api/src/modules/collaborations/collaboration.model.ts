import mongoose, { Schema, type Types } from "mongoose";
import { COLLABORATION_STATUSES, type CollaborationStatus } from "@naano/shared";

export type CollaborationDoc = {
  applicationId: Types.ObjectId;
  campaignId: Types.ObjectId;
  brandUserId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  status: CollaborationStatus;
  amount: number;
  currency: string;
  contentUrl?: string;
  contentNotes?: string;
  publishedUrl?: string;
  createdAt: Date;
  updatedAt: Date;
};

const collaborationSchema = new Schema<CollaborationDoc>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      required: true,
      unique: true,
    },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: COLLABORATION_STATUSES, default: "ACCEPTED" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    contentUrl: String,
    contentNotes: String,
    publishedUrl: String,
  },
  { timestamps: true },
);

export const Collaboration = mongoose.model<CollaborationDoc>(
  "Collaboration",
  collaborationSchema,
);
