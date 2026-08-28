import mongoose from "mongoose";
import { config } from "../../config.ts";

export async function connectMongo(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(config.mongodbUri);
}

export function mongoStatus(): "connected" | "disconnected" {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}
