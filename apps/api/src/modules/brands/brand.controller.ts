import type { Request, Response } from "express";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { getBrandForUser, serializeBrand, upsertBrand, upsertBrandSchema, completeBrandOnboarding } from "./brand.service.ts";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getBrandForUser(req.user!.id);
  res.json({ profile: profile ? serializeBrand(profile) : null });
});

export const upsertMe = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(upsertBrandSchema, req.body);
  const profile = await upsertBrand(req.user!.id, input);
  res.json({ profile: serializeBrand(profile) });
});

export const completeMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await completeBrandOnboarding(req.user!.id);
  res.json({ profile: serializeBrand(profile) });
});
