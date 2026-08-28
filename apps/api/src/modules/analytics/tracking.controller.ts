import type { Request, Response } from "express";
import { recordEvent } from "./recordEvent.ts";
import { TrackingLink } from "./trackingLink.model.ts";

const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

async function loadLink(token: string | undefined) {
  if (!token) return null;
  return TrackingLink.findOne({ token });
}

async function recordClick(
  req: Request,
  link: NonNullable<Awaited<ReturnType<typeof loadLink>>>,
  source: "redirect" | "pixel",
) {
  await recordEvent({
    type: "TRACKING_CLICK",
    campaignId: link.campaignId,
    creatorUserId: link.creatorUserId,
    collaborationId: link.collaborationId,
    trackingLinkId: link._id,
    metadata: {
      token: link.token,
      postLabel: link.postLabel,
      destinationUrl: link.destinationUrl,
      source,
      userAgent: req.get("user-agent"),
    },
  });
}

export async function trackingRedirect(req: Request, res: Response) {
  const link = await loadLink(req.params.token);
  if (!link) {
    res.status(404).send("Unknown tracking link");
    return;
  }
  await recordClick(req, link, "redirect");
  res.redirect(302, link.destinationUrl);
}

export async function trackingPixel(req: Request, res: Response) {
  const link = await loadLink(req.params.token);
  if (!link) {
    res.status(404).end();
    return;
  }
  await recordClick(req, link, "pixel");
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.status(200).end(PIXEL_GIF);
}
