import crypto from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../../common/asyncHandler.ts";
import { parseBody } from "../../common/validate.ts";
import { config, hasGoogleOAuth } from "../../config.ts";
import {
  afterAuthPath,
  authProviders,
  exchangeGoogleCode,
  googleAuthorizationUrl,
  googleUserinfo,
  setAccountRole,
  setRoleSchema,
  upsertFromOAuth,
} from "./auth.service.ts";
import { attachSession, clearSession, clientUrl } from "./session.ts";

type GoogleState = { purpose: "google-login"; nonce: string };

function googleState() {
  return jwt.sign(
    { purpose: "google-login", nonce: crypto.randomBytes(8).toString("hex") } satisfies GoogleState,
    config.jwtSecret,
    { expiresIn: "10m" },
  );
}

function readGoogleState(state: string) {
  const payload = jwt.verify(state, config.jwtSecret) as GoogleState;
  if (payload.purpose !== "google-login") throw new Error("bad state");
}

export const providersHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ providers: authProviders() });
});

export const googleStartHandler = asyncHandler(async (_req: Request, res: Response) => {
  if (!hasGoogleOAuth()) {
    res.redirect(
      clientUrl("/login", {
        error:
          "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then add the redirect URI on the Google Cloud OAuth client.",
      }),
    );
    return;
  }
  res.redirect(googleAuthorizationUrl(googleState()));
});

export const googleCallbackHandler = asyncHandler(async (req: Request, res: Response) => {
  const error = typeof req.query.error === "string" ? req.query.error : undefined;
  if (error) {
    res.redirect(clientUrl("/login", { error }));
    return;
  }
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!code || !state) {
    res.redirect(clientUrl("/login", { error: "Google did not return an authorization code." }));
    return;
  }
  try {
    readGoogleState(state);
    const accessToken = await exchangeGoogleCode(code);
    const identity = await googleUserinfo(accessToken);
    const result = await upsertFromOAuth(identity);
    attachSession(res, result.token);
    res.redirect(clientUrl(afterAuthPath(result.user)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Google sign-in failed.";
    res.redirect(clientUrl("/login", { error: message }));
  }
});

export const setRoleHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(setRoleSchema, req.body);
  const result = await setAccountRole(req.user!.id, input.role);
  attachSession(res, result.token);
  res.json({ user: result.user });
});

export const logoutHandler = asyncHandler(async (_req: Request, res: Response) => {
  clearSession(res);
  res.json({ ok: true });
});

export const meHandler = asyncHandler(async (req: Request, res: Response) => {
  res.json({ user: req.user, needsRole: !req.user?.role });
});
