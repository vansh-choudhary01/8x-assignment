import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { AppError } from "./errors.ts";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL", message: "Something went wrong" },
  });
}
