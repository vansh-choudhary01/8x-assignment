import { Queue } from "bullmq";
import { config } from "../../config.ts";

export const ingestionQueue = new Queue("ingestion", {
  connection: { url: config.redisUrl },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 4000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export type IngestionJob =
  | { kind: "WEBSITE"; brandProfileId: string; url: string }
  | { kind: "CREATOR_PROFILE"; creatorProfileId: string; linkedInUrl: string };
