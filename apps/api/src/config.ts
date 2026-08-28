import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const envPath = path.join(repoRoot, ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  jwtSecret: required("JWT_SECRET", "dev-only-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  mongodbUri: required(
    "MONGODB_URI",
    "mongodb://127.0.0.1:27017/naano",
  ),
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  ingestUserAgent:
    process.env.INGEST_USER_AGENT ??
    "NaanoBot/0.1 (assignment; contact via repo)",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  openaiEmbeddingModel:
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:5173/api/auth/google/callback",
};

export function hasGoogleOAuth(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export const isProduction = config.nodeEnv === "production";
