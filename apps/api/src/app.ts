import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { config } from "./config.ts";
import { errorHandler } from "./common/errorHandler.ts";
import { mongoStatus } from "./infrastructure/mongodb/connect.ts";
import { redisStatus } from "./infrastructure/redis/client.ts";
import { trackingPixel, trackingRedirect } from "./modules/analytics/tracking.controller.ts";
import { workspaceRouter } from "./modules/analytics/workspace.routes.ts";
import { applicationRouter } from "./modules/applications/application.routes.ts";
import { authRouter } from "./modules/auth/auth.routes.ts";
import { brandRouter } from "./modules/brands/brand.routes.ts";
import { campaignRouter } from "./modules/campaigns/campaign.routes.ts";
import { collaborationRouter } from "./modules/collaborations/collaboration.routes.ts";
import { creatorRouter } from "./modules/creators/creator.routes.ts";
import { marketplaceRouter } from "./modules/creators/marketplace.routes.ts";
import { aiRouter } from "./modules/ai/ai.routes.ts";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", async (_req, res) => {
    const redis = await redisStatus();
    res.json({
      ok: true,
      mongo: mongoStatus(),
      redis,
    });
  });

  app.get("/t/:token", (req, res, next) => {
    void trackingRedirect(req, res).catch(next);
  });
  app.get("/p/:token", (req, res, next) => {
    void trackingPixel(req, res).catch(next);
  });

  app.use("/api/auth", authRouter);
  app.use("/api/creators", creatorRouter);
  app.use("/api/brands", brandRouter);
  app.use("/api/marketplace", marketplaceRouter);
  app.use("/api/campaigns", campaignRouter);
  app.use("/api/applications", applicationRouter);
  app.use("/api/collaborations", collaborationRouter);
  app.use("/api/workspace", workspaceRouter);
  app.use("/api/ai", aiRouter);

  app.use(errorHandler);
  return app;
}
