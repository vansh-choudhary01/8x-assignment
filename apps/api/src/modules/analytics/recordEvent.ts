import type { Types } from "mongoose";
import type { AnalyticsEventType } from "@naano/shared";
import { AnalyticsEvent, type AnalyticsEventMetadata } from "./analyticsEvent.model.ts";

export async function recordEvent(input: {
  type: AnalyticsEventType;
  actorUserId?: string | Types.ObjectId;
  campaignId?: string | Types.ObjectId;
  creatorUserId?: string | Types.ObjectId;
  collaborationId?: string | Types.ObjectId;
  trackingLinkId?: string | Types.ObjectId;
  metadata?: AnalyticsEventMetadata;
}) {
  await AnalyticsEvent.create(input);
}
