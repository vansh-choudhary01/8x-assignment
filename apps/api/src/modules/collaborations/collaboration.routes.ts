import type { Request, Response } from "express";
import { Router } from "express";
import { COLLABORATION_STATUSES, FUNNEL_EVENT_TYPES } from "@naano/shared";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { routeParam } from "../../common/routeParam.ts";
import { requireAuth, requireSettledRole } from "../../middleware/auth.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { TrackingLink } from "../analytics/trackingLink.model.ts";
import { listMessages, sendMessage } from "../messaging/message.service.ts";
import {
  getCollaborationForUser,
  listCollaborations,
  serializeCollaboration,
  transitionCollaboration,
} from "./collaboration.service.ts";

export const collaborationRouter = Router();
collaborationRouter.use(requireAuth, requireSettledRole);

collaborationRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await listCollaborations(req.user!.id, req.user!.role!);
    res.json({
      collaborations: await Promise.all(items.map((item) => serializeCollaboration(item))),
    });
  }),
);

collaborationRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const item = await getCollaborationForUser(routeParam(req.params.id), req.user!.id);
    res.json({ collaboration: await serializeCollaboration(item) });
  }),
);

collaborationRouter.post(
  "/:id/transition",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(
      z.object({
        status: z.enum(COLLABORATION_STATUSES),
        contentUrl: z.string().url().optional().or(z.literal("")),
        contentNotes: z.string().max(4000).optional(),
        publishedUrl: z.string().url().optional().or(z.literal("")),
      }),
      req.body,
    );
    const item = await transitionCollaboration(req.user!.id, req.user!.role!, routeParam(req.params.id), input.status, {
      contentUrl: input.contentUrl || undefined,
      contentNotes: input.contentNotes,
      publishedUrl: input.publishedUrl || undefined,
    });
    res.json({ collaboration: await serializeCollaboration(item) });
  }),
);

collaborationRouter.get(
  "/:id/messages",
  asyncHandler(async (req: Request, res: Response) => {
    const messages = await listMessages(routeParam(req.params.id), req.user!.id);
    res.json({
      messages: messages.map((message) => ({
        id: String(message._id),
        senderUserId: String(message.senderUserId),
        body: message.body,
        createdAt: message.createdAt,
      })),
    });
  }),
);

collaborationRouter.post(
  "/:id/messages",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(z.object({ body: z.string().trim().min(1).max(8000) }), req.body);
    const message = await sendMessage(routeParam(req.params.id), req.user!.id, input.body);
    res.status(201).json({
      message: {
        id: String(message._id),
        senderUserId: String(message.senderUserId),
        body: message.body,
        createdAt: message.createdAt,
      },
    });
  }),
);

collaborationRouter.post(
  "/:id/funnel",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(
      z.object({
        type: z.enum(FUNNEL_EVENT_TYPES),
        amount: z.coerce.number().optional(),
        note: z.string().max(400).optional(),
      }),
      req.body,
    );
    const collaboration = await getCollaborationForUser(routeParam(req.params.id), req.user!.id);
    if (req.user!.role !== "BRAND") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the brand can record funnel events" } });
      return;
    }
    if (input.type === "REVENUE" && (input.amount === undefined || Number.isNaN(input.amount))) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Revenue needs a recorded amount" } });
      return;
    }
    const tracking = await TrackingLink.findOne({ collaborationId: collaboration._id });
    await recordEvent({
      type: input.type,
      actorUserId: req.user!.id,
      campaignId: collaboration.campaignId,
      creatorUserId: collaboration.creatorUserId,
      collaborationId: collaboration._id,
      trackingLinkId: tracking?._id,
      metadata: { amount: input.amount, note: input.note, postLabel: tracking?.postLabel },
    });
    res.json({ ok: true });
  }),
);
