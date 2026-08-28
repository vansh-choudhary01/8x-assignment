import type { Request, Response } from "express";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { requireAuth, requireRole, requireSettledRole } from "../../middleware/auth.ts";
import { analyticsForUser, funnelBreakdown, funnelFor } from "./analytics.service.ts";
import { earningsFor } from "../earnings/earnings.service.ts";

export const workspaceRouter = Router();
workspaceRouter.use(requireAuth, requireSettledRole);

workspaceRouter.get(
  "/analytics",
  asyncHandler(async (req: Request, res: Response) => {
    const [summary, funnel, breakdown] = await Promise.all([
      analyticsForUser(req.user!.id, req.user!.role!),
      funnelFor(req.user!.id, req.user!.role!),
      funnelBreakdown(req.user!.id, req.user!.role!),
    ]);
    res.json({ summary, funnel, breakdown });
  }),
);

workspaceRouter.get(
  "/earnings",
  requireRole("CREATOR"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await earningsFor(req.user!.id));
  }),
);
