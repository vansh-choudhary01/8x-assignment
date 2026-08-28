export const USER_ROLES = ["BRAND", "CREATOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUSES_ACCEPTING_APPLICATIONS = [
  "OPEN",
  "IN_PROGRESS",
] as const satisfies readonly CampaignStatus[];
export type CampaignStatusAcceptingApplications =
  (typeof CAMPAIGN_STATUSES_ACCEPTING_APPLICATIONS)[number];

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "INVITED",
  "WITHDRAWN",
  "ACCEPTED",
  "REJECTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const COLLABORATION_STATUSES = [
  "ACCEPTED",
  "CONTENT_SUBMITTED",
  "APPROVED",
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type CollaborationStatus = (typeof COLLABORATION_STATUSES)[number];

export const ANALYTICS_EVENT_TYPES = [
  "CAMPAIGN_VIEW",
  "CREATOR_PROFILE_VIEW",
  "APPLICATION_SUBMITTED",
  "APPLICATION_ACCEPTED",
  "APPLICATION_REJECTED",
  "CONTENT_SUBMITTED",
  "CONTENT_APPROVED",
  "COLLABORATION_PUBLISHED",
  "COLLABORATION_COMPLETED",
  "MESSAGE_SENT",
  "OUTREACH_SENT",
  "TRACKING_CLICK",
  "LEAD",
  "PIPELINE",
  "REVENUE",
] as const;
export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export const FUNNEL_EVENT_TYPES = [
  "LEAD",
  "PIPELINE",
  "REVENUE",
] as const satisfies readonly AnalyticsEventType[];
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export const FUNNEL_METRIC_TYPES = [
  "TRACKING_CLICK",
  "LEAD",
  "PIPELINE",
  "REVENUE",
] as const satisfies readonly AnalyticsEventType[];
export type FunnelMetricType = (typeof FUNNEL_METRIC_TYPES)[number];

export const LEDGER_ENTRY_TYPES = [
  "PENDING",
  "EARNED",
  "RELEASED",
  "VOIDED",
] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const AI_ACTION_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED"] as const;
export type AiActionStatus = (typeof AI_ACTION_STATUSES)[number];

export const BRAND_INGESTION_STATUSES = [
  "IDLE",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
] as const;
export type BrandIngestionStatus = (typeof BRAND_INGESTION_STATUSES)[number];

export const CREATOR_INGESTION_STATUSES = [
  "IDLE",
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "BLOCKED",
  "FAILED",
] as const;
export type CreatorIngestionStatus = (typeof CREATOR_INGESTION_STATUSES)[number];

export const ENRICHMENT_STATUSES = ["IDLE", "SKIPPED", "SUCCEEDED", "FAILED"] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

export const PRICING_CONFIDENCES = ["none", "low", "medium"] as const;
export type PricingConfidence = (typeof PRICING_CONFIDENCES)[number];

export const INSIGHT_FIELD_ORIGINS = ["sourced", "derived", "missing"] as const;
export type InsightFieldOrigin = (typeof INSIGHT_FIELD_ORIGINS)[number];

export type AiPageContext = {
  path: string;
  campaignId?: string;
  collaborationId?: string;
  creatorId?: string;
};
