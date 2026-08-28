import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { requireAuth, requireSettledRole } from "../../middleware/auth.ts";
import { hasOpenAI } from "../../infrastructure/ai/openai.ts";
import {
  cancelAction,
  confirmAction,
  getOrCreateConversation,
  listVisibleMessages,
  runTurn,
} from "./runtime.ts";
import { draftApplicationForCampaign, draftCampaignFromIntent, draftCollaborationReply } from "./drafts.ts";
import { searchCreatorsByQuery } from "../matching/search.ts";
import type { AiActor } from "./types.ts";

function actor(req: Request): AiActor {
  return { id: req.user!.id, name: req.user!.name, role: req.user!.role! };
}

const contextSchema = z
  .object({
    path: z.string().max(400).optional().default(""),
    campaignId: z.string().optional(),
    collaborationId: z.string().optional(),
    creatorId: z.string().optional(),
  })
  .optional();

export const aiRouter = Router();
aiRouter.use(requireAuth, requireSettledRole);

aiRouter.get(
  "/status",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ available: hasOpenAI() });
  }),
);

aiRouter.get(
  "/conversation",
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await getOrCreateConversation(actor(req));
    res.json(await listVisibleMessages(String(conversation._id), req.user!.id));
  }),
);

aiRouter.post(
  "/turn",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(
      z.object({
        message: z.string().trim().min(1).max(8000),
        context: contextSchema,
      }),
      req.body,
    );
    const result = await runTurn(actor(req), {
      message: input.message,
      context: input.context ? { path: input.context.path, ...input.context } : undefined,
    });
    res.json(result);
  }),
);

aiRouter.post(
  "/actions/:id/confirm",
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ action: await confirmAction(actor(req), req.params.id) });
  }),
);

aiRouter.post(
  "/actions/:id/cancel",
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ action: await cancelAction(actor(req), req.params.id) });
  }),
);

aiRouter.post(
  "/drafts/campaign",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(z.object({ intent: z.string().trim().min(8).max(4000) }), req.body);
    if (req.user!.role !== "BRAND") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Brands draft campaigns" } });
      return;
    }
    res.json({ draft: await draftCampaignFromIntent(actor(req), input.intent) });
  }),
);

aiRouter.post(
  "/drafts/application",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(z.object({ campaignId: z.string().min(1) }), req.body);
    if (req.user!.role !== "CREATOR") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Creators draft applications" } });
      return;
    }
    res.json({ draft: await draftApplicationForCampaign(actor(req), input.campaignId) });
  }),
);

aiRouter.post(
  "/drafts/reply",
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(
      z.object({
        collaborationId: z.string().min(1),
        instruction: z.string().trim().max(2000).optional(),
      }),
      req.body,
    );
    res.json({
      draft: await draftCollaborationReply(
        actor(req),
        input.collaborationId,
        input.instruction || "Write a helpful, professional reply to continue the conversation.",
      ),
    });
  }),
);

aiRouter.post(
  "/search/creators",
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== "BRAND") {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Brands search creators" } });
      return;
    }
    const input = parseBody(z.object({ query: z.string().trim().min(3).max(500) }), req.body);
    res.json(await searchCreatorsByQuery(input.query));
  }),
);
