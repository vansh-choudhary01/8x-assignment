import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.ts";
import { completeMe, getMe, upsertMe } from "./creator.controller.ts";

export const creatorRouter = Router();

creatorRouter.use(requireAuth, requireRole("CREATOR"));
creatorRouter.get("/me", getMe);
creatorRouter.put("/me", upsertMe);
creatorRouter.post("/me/complete", completeMe);
