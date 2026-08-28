import { Router } from "express";
import { requireAuth } from "../../middleware/auth.ts";
import {
  googleCallbackHandler,
  googleStartHandler,
  logoutHandler,
  meHandler,
  providersHandler,
  setRoleHandler,
} from "./auth.controller.ts";

export const authRouter = Router();

authRouter.get("/providers", providersHandler);
authRouter.get("/google", googleStartHandler);
authRouter.get("/google/callback", googleCallbackHandler);
authRouter.post("/logout", logoutHandler);
authRouter.get("/me", requireAuth, meHandler);
authRouter.post("/role", requireAuth, setRoleHandler);
