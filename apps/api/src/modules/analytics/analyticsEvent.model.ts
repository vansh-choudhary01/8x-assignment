import mongoose, { Schema, type Types } from "mongoose";
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "@naano/shared";

export type AnalyticsEventMetadata = {
  applicationId?: string;
  source?: "invite" | "redirect" | "pixel";
  amount?: number;
  note?: string;
  postLabel?: string;
  publishedUrl?: string;
  title?: string;
  creatorProfileId?: string;
  token?: string;
  destinationUrl?: string;
  userAgent?: string;
  messageId?: string;
};

export type AnalyticsEventDoc = {
  type: AnalyticsEventType;
  actorUserId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  creatorUserId?: Types.ObjectId;
  collaborationId?: Types.ObjectId;
  trackingLinkId?: Types.ObjectId;
  metadata?: AnalyticsEventMetadata;
  createdAt: Date;
};

const analyticsEventSchema = new Schema<AnalyticsEventDoc>(
  {
    type: { type: String, required: true, enum: ANALYTICS_EVENT_TYPES, index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    collaborationId: { type: Schema.Types.ObjectId, ref: "Collaboration" },
    trackingLinkId: { type: Schema.Types.ObjectId, ref: "TrackingLink" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AnalyticsEvent = mongoose.model<AnalyticsEventDoc>(
  "AnalyticsEvent",
  analyticsEventSchema,
);
