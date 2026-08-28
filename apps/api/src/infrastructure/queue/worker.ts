import { Worker } from "bullmq";
import { config } from "../../config.ts";
import type { IngestionJob } from "./index.ts";
import { processBrandIngestion } from "../../modules/brands/brandIngestion.ts";
import { processCreatorIngestion } from "../../modules/creators/creatorIngestion.ts";
import { BrandProfile } from "../../modules/brands/brandProfile.model.ts";
import { CreatorProfile } from "../../modules/creators/creatorProfile.model.ts";

export function startIngestionWorker(): Worker<IngestionJob> {
  const worker = new Worker<IngestionJob>(
    "ingestion",
    async (job) => {
      const data = job.data;
      if (data.kind === "CREATOR_PROFILE") {
        await processCreatorIngestion(data.creatorProfileId);
        return;
      }
      if (data.kind === "WEBSITE") {
        await processBrandIngestion(data.brandProfileId);
      }
    },
    {
      connection: { url: config.redisUrl },
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error("Ingestion job failed", job?.id, err);
    const data = job?.data;
    if (!data) return;
    if (data.kind === "CREATOR_PROFILE") {
      void CreatorProfile.findByIdAndUpdate(data.creatorProfileId, {
        ingestionStatus: "FAILED",
        ingestionError: err.message,
      });
    }
    if (data.kind === "WEBSITE") {
      void BrandProfile.findByIdAndUpdate(data.brandProfileId, {
        ingestionStatus: "FAILED",
        ingestionError: err.message,
      });
    }
  });

  return worker;
}
