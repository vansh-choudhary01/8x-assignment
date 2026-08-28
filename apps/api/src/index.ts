import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { connectMongo } from "./infrastructure/mongodb/connect.ts";
import { connectRedis } from "./infrastructure/redis/client.ts";
import { startIngestionWorker } from "./infrastructure/queue/worker.ts";

async function main() {
  await connectMongo();
  try {
    await connectRedis();
  } catch (err) {
    console.warn("Redis is not reachable yet. Queue jobs will fail until it is.", err);
  }

  startIngestionWorker();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
