import type { Request, Response } from "express";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { requireAuth, requireRole } from "../../middleware/auth.ts";
import { getMarketplaceCreator, listMarketplaceCreators } from "./marketplace.service.ts";

export const marketplaceRouter = Router();
marketplaceRouter.use(requireAuth, requireRole("BRAND"));

marketplaceRouter.get(
  "/creators",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ creators: await listMarketplaceCreators() });
  }),
);

marketplaceRouter.get(
  "/creators/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const creator = await getMarketplaceCreator(req.params.id, req.user!.id, true);
    res.json({ creator });
  }),
);
