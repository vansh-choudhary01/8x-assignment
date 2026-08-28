import { Redis } from "ioredis";
import { config } from "../../config.ts";

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return client;
}

export async function connectRedis(): Promise<void> {
  const redis = getRedis();
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export async function redisStatus(): Promise<"connected" | "disconnected"> {
  try {
    const redis = getRedis();
    if (redis.status === "wait") {
      await redis.connect();
    }
    const pong = await redis.ping();
    return pong === "PONG" ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}
