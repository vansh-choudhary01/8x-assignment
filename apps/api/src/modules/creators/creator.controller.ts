import type { Request, Response } from "express";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import {
  completeOnboarding,
  getCreatorForUser,
  serializeCreator,
  upsertCreator,
  upsertCreatorSchema,
} from "./creator.service.ts";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getCreatorForUser(req.user!.id);
  res.json({
    profile: profile ? serializeCreator(profile, req.user!.name) : null,
  });
});

export const upsertMe = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(upsertCreatorSchema, req.body);
  const profile = await upsertCreator(req.user!.id, input);
  res.json({ profile: serializeCreator(profile, req.user!.name) });
});

export const completeMe = asyncHandler(async (req: Request, res: Response) => {
  const profile = await completeOnboarding(req.user!.id);
  res.json({ profile: serializeCreator(profile, req.user!.name) });
});
