import { FUNNEL_METRIC_TYPES, type AnalyticsEventType, type UserRole } from "@naano/shared";
import { config } from "../../config.ts";
import { AnalyticsEvent } from "./analyticsEvent.model.ts";
import { TrackingLink } from "./trackingLink.model.ts";
import { Campaign } from "../campaigns/campaign.model.ts";
import { User } from "../users/user.model.ts";
import { CreatorProfile } from "../creators/creatorProfile.model.ts";
import { Collaboration } from "../collaborations/collaboration.model.ts";

function countBy(events: { type: AnalyticsEventType }[]) {
  const map: Partial<Record<AnalyticsEventType, number>> = {};
  for (const event of events) {
    map[event.type] = (map[event.type] ?? 0) + 1;
  }
  return map;
}

function trackingLinksFor(userId: string, role: UserRole) {
  return TrackingLink.find(role === "BRAND" ? { brandUserId: userId } : { creatorUserId: userId });
}

async function funnelEvents(userId: string, role: UserRole) {
  if (role === "CREATOR") {
    return AnalyticsEvent.find({
      creatorUserId: userId,
      type: { $in: [...FUNNEL_METRIC_TYPES] },
    });
  }
  const campaigns = await Campaign.find({ brandUserId: userId }).select("_id");
  return AnalyticsEvent.find({
    campaignId: { $in: campaigns.map((item) => item._id) },
    type: { $in: [...FUNNEL_METRIC_TYPES] },
  });
}

export async function analyticsForUser(userId: string, role: UserRole) {
  let events;
  if (role === "CREATOR") {
    events = await AnalyticsEvent.find({ creatorUserId: userId }).sort({ createdAt: -1 }).limit(400);
  } else {
    const campaigns = await Campaign.find({ brandUserId: userId }).select("_id");
    const campaignIds = campaigns.map((item) => item._id);
    events = await AnalyticsEvent.find({
      $or: [{ actorUserId: userId }, { campaignId: { $in: campaignIds } }],
    })
      .sort({ createdAt: -1 })
      .limit(400);
  }

  const links = await trackingLinksFor(userId, role);

  return {
    totals: countBy(events),
    recent: events.slice(0, 50).map((event) => ({
      id: String(event._id),
      type: event.type,
      campaignId: event.campaignId ? String(event.campaignId) : null,
      creatorUserId: event.creatorUserId ? String(event.creatorUserId) : null,
      collaborationId: event.collaborationId ? String(event.collaborationId) : null,
      trackingLinkId: event.trackingLinkId ? String(event.trackingLinkId) : null,
      metadata: event.metadata ?? {},
      createdAt: event.createdAt,
    })),
    trackingLinks: links.map((link) => ({
      id: String(link._id),
      token: link.token,
      collaborationId: String(link.collaborationId),
      campaignId: String(link.campaignId),
      creatorUserId: String(link.creatorUserId),
      postLabel: link.postLabel,
      destinationUrl: link.destinationUrl,
      clickUrl: `${config.clientOrigin}/t/${link.token}`,
    })),
  };
}

export async function funnelFor(userId: string, role: UserRole) {
  const [links, events] = await Promise.all([trackingLinksFor(userId, role), funnelEvents(userId, role)]);
  return {
    clicks: events.filter((e) => e.type === "TRACKING_CLICK").length,
    leads: events.filter((e) => e.type === "LEAD").length,
    pipeline: events.filter((e) => e.type === "PIPELINE").length,
    revenue: events
      .filter((e) => e.type === "REVENUE")
      .reduce((sum, e) => sum + Number(e.metadata?.amount ?? 0), 0),
    linkCount: links.length,
  };
}

type FunnelBucket = {
  clicks: number;
  leads: number;
  pipeline: number;
  revenue: number;
};

function emptyBucket(): FunnelBucket {
  return { clicks: 0, leads: 0, pipeline: 0, revenue: 0 };
}

function addToBucket(bucket: FunnelBucket, type: AnalyticsEventType, amount: number) {
  if (type === "TRACKING_CLICK") bucket.clicks += 1;
  if (type === "LEAD") bucket.leads += 1;
  if (type === "PIPELINE") bucket.pipeline += 1;
  if (type === "REVENUE") bucket.revenue += amount;
}

export async function funnelBreakdown(userId: string, role: UserRole) {
  const events = await funnelEvents(userId, role);

  const byCreator = new Map<string, FunnelBucket>();
  const byCampaign = new Map<string, FunnelBucket>();
  const byCollaboration = new Map<string, FunnelBucket>();

  for (const event of events) {
    const amount = Number(event.metadata?.amount ?? 0);
    const creatorKey = event.creatorUserId ? String(event.creatorUserId) : "unattributed";
    const campaignKey = event.campaignId ? String(event.campaignId) : "unattributed";
    const collabKey = event.collaborationId ? String(event.collaborationId) : "unattributed";
    if (!byCreator.has(creatorKey)) byCreator.set(creatorKey, emptyBucket());
    if (!byCampaign.has(campaignKey)) byCampaign.set(campaignKey, emptyBucket());
    if (!byCollaboration.has(collabKey)) byCollaboration.set(collabKey, emptyBucket());
    addToBucket(byCreator.get(creatorKey)!, event.type, amount);
    addToBucket(byCampaign.get(campaignKey)!, event.type, amount);
    addToBucket(byCollaboration.get(collabKey)!, event.type, amount);
  }

  return {
    note: "Counts are stored TRACKING_CLICK, LEAD, PIPELINE, and REVENUE events only. Zero means none were recorded.",
    byCreator: await Promise.all(
      [...byCreator.entries()].map(async ([creatorUserId, stats]) => {
        const [user, profile] = await Promise.all([
          creatorUserId === "unattributed" ? null : User.findById(creatorUserId),
          creatorUserId === "unattributed" ? null : CreatorProfile.findOne({ userId: creatorUserId }),
        ]);
        return {
          creatorUserId,
          name: profile?.publicName || user?.name || creatorUserId,
          ...stats,
        };
      }),
    ),
    byCampaign: await Promise.all(
      [...byCampaign.entries()].map(async ([campaignId, stats]) => {
        const campaign = campaignId === "unattributed" ? null : await Campaign.findById(campaignId);
        return { campaignId, title: campaign?.title || campaignId, ...stats };
      }),
    ),
    byCollaboration: await Promise.all(
      [...byCollaboration.entries()].map(async ([collaborationId, stats]) => {
        const collab =
          collaborationId === "unattributed" ? null : await Collaboration.findById(collaborationId);
        const [campaign, tracking] = await Promise.all([
          collab ? Campaign.findById(collab.campaignId) : null,
          collaborationId === "unattributed" ? null : TrackingLink.findOne({ collaborationId }),
        ]);
        return {
          collaborationId,
          title: campaign?.title || collaborationId,
          postLabel: tracking?.postLabel,
          ...stats,
        };
      }),
    ),
  };
}
