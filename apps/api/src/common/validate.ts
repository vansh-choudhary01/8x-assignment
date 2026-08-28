import type { ZodType } from "zod";
import { errors } from "./errors.ts";

export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw errors.badRequest(issue?.message ?? "Invalid request");
  }
  return result.data;
}
