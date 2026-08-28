import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { routeParam } from "../../common/routeParam.ts";
import { requireAuth, requireRole, requireSettledRole } from "../../middleware/auth.ts";
import {
  acceptApplication,
  acceptInvite,
  applySchema,
  applyToCampaign,
  inviteCreator,
  listApplicationsForCampaign,
  listApplicationsForCreator,
  rejectApplication,
  serializeApplication,
} from "./application.service.ts";
import { serializeCollaboration } from "../collaborations/collaboration.service.ts";

export const applicationRouter = Router();
applicationRouter.use(requireAuth, requireSettledRole);

applicationRouter.get(
  "/mine",
  requireRole("CREATOR"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ applications: await listApplicationsForCreator(req.user!.id) });
  }),
);

applicationRouter.get(
  "/campaign/:campaignId",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      applications: await listApplicationsForCampaign(req.user!.id, routeParam(req.params.campaignId)),
    });
  }),
);

applicationRouter.post(
  "/campaign/:campaignId",
  requireRole("CREATOR"),
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(applySchema, req.body);
    const application = await applyToCampaign(req.user!.id, routeParam(req.params.campaignId), input.pitch);
    res.status(201).json({ application: serializeApplication(application) });
  }),
);

applicationRouter.post(
  "/campaign/:campaignId/invite",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(z.object({ creatorUserId: z.string().min(1) }), req.body);
    const result = await inviteCreator(req.user!.id, routeParam(req.params.campaignId), input.creatorUserId);
    res.status(201).json({
      application: serializeApplication(result.application),
      collaboration: result.collaboration
        ? await serializeCollaboration(result.collaboration)
        : null,
    });
  }),
);

applicationRouter.post(
  "/:id/accept-invite",
  requireRole("CREATOR"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await acceptInvite(req.user!.id, routeParam(req.params.id));
    res.json({
      application: serializeApplication(result.application),
      collaboration: await serializeCollaboration(result.collaboration),
    });
  }),
);

applicationRouter.post(
  "/:id/accept",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await acceptApplication(req.user!.id, routeParam(req.params.id));
    res.json({
      application: serializeApplication(result.application),
      collaboration: await serializeCollaboration(result.collaboration),
    });
  }),
);

applicationRouter.post(
  "/:id/reject",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    const application = await rejectApplication(req.user!.id, routeParam(req.params.id));
    res.json({ application: serializeApplication(application) });
  }),
);
