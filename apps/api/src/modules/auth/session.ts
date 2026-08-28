import type { CookieOptions, Response } from "express";
import { config, isProduction } from "../../config.ts";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function attachSession(res: Response, token: string) {
  res.cookie("token", token, cookieOptions);
}

export function clearSession(res: Response) {
  res.clearCookie("token", { ...cookieOptions, maxAge: undefined });
}

export function clientUrl(pathname: string, query: Record<string, string> = {}) {
  const url = new URL(pathname, config.clientOrigin);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}
