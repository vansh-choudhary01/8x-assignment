import type { Request, Response } from "express";
import { Router } from "express";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { routeParam } from "../../common/routeParam.ts";
import { requireAuth, requireRole, requireSettledRole } from "../../middleware/auth.ts";
import {
  brandName,
  createCampaign,
  createCampaignSchema,
  getCampaign,
  listCampaignsForBrand,
  listOpenCampaigns,
  serializeCampaign,
  viewCampaign,
} from "./campaign.service.ts";
import { rankCreatorsForCampaign } from "../matching/rank.ts";

export const campaignRouter = Router();
campaignRouter.use(requireAuth, requireSettledRole);

campaignRouter.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const items =
      req.user!.role === "BRAND"
        ? await listCampaignsForBrand(req.user!.id)
        : await listOpenCampaigns();
    const names = await Promise.all(items.map((item) => brandName(String(item.brandUserId))));
    res.json({
      campaigns: items.map((item, index) => serializeCampaign(item, names[index])),
    });
  }),
);

campaignRouter.post(
  "/",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    const input = parseBody(createCampaignSchema, req.body);
    const campaign = await createCampaign(req.user!.id, input);
    const name = await brandName(req.user!.id);
    res.status(201).json({ campaign: serializeCampaign(campaign, name) });
  }),
);

campaignRouter.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await viewCampaign(routeParam(req.params.id), req.user!.id);
    const name = await brandName(String(campaign.brandUserId));
    res.json({ campaign: serializeCampaign(campaign, name) });
  }),
);

campaignRouter.get(
  "/:id/matches",
  requireRole("BRAND"),
  asyncHandler(async (req: Request, res: Response) => {
    const campaign = await getCampaign(routeParam(req.params.id));
    if (String(campaign.brandUserId) !== req.user!.id) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Not your campaign" } });
      return;
    }
    const matches = await rankCreatorsForCampaign(campaign);
    res.json({ matches });
  }),
);
