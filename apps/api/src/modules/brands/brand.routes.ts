import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.ts";
import { completeMe, getMe, upsertMe } from "./brand.controller.ts";

export const brandRouter = Router();

brandRouter.use(requireAuth, requireRole("BRAND"));
brandRouter.get("/me", getMe);
brandRouter.put("/me", upsertMe);
brandRouter.post("/me/complete", completeMe);
