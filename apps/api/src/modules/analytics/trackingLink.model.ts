import crypto from "node:crypto";
import mongoose, { Schema, type Types } from "mongoose";

export type TrackingLinkDoc = {
  token: string;
  collaborationId: Types.ObjectId;
  campaignId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  brandUserId: Types.ObjectId;
  postLabel: string;
  destinationUrl: string;
  createdAt: Date;
};

const trackingLinkSchema = new Schema<TrackingLinkDoc>(
  {
    token: { type: String, required: true, unique: true, index: true },
    collaborationId: { type: Schema.Types.ObjectId, ref: "Collaboration", required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    postLabel: { type: String, default: "LinkedIn post" },
    destinationUrl: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const TrackingLink = mongoose.model<TrackingLinkDoc>("TrackingLink", trackingLinkSchema);

export function newTrackingToken(): string {
  return crypto.randomBytes(12).toString("hex");
}
