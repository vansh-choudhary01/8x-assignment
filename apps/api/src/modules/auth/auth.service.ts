import { z } from "zod";
import { USER_ROLES, type UserRole } from "@naano/shared";
import { config, hasGoogleOAuth } from "../../config.ts";
import { errors } from "../../common/errors.ts";
import { signUserToken, type AuthUser } from "../../middleware/auth.ts";
import { User } from "../users/user.model.ts";

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function afterAuthPath(user: { role?: UserRole }) {
  if (!user.role) return "/choose-role";
  return user.role === "CREATOR" ? "/creator" : "/brand";
}

export function authProviders() {
  return {
    google: { configured: hasGoogleOAuth() },
  };
}

export type OauthIdentity = {
  provider: "google";
  providerId: string;
  email: string;
  name: string;
  pictureUrl?: string;
};

export async function upsertFromOAuth(identity: OauthIdentity) {
  const email = identity.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw errors.badRequest("The identity provider did not return an email address.");
  }
  const name = identity.name.trim() || email.split("@")[0] || "Member";

  let user = await User.findOne({ googleId: identity.providerId });

  if (!user) {
    user = await User.findOne({ email });
  }

  if (!user) {
    user = await User.create({
      email,
      name,
      pictureUrl: identity.pictureUrl,
      googleId: identity.providerId,
    });
  } else {
    if (user.googleId && user.googleId !== identity.providerId) {
      throw errors.conflict("This Google account is already linked to a different Naano user.");
    }
    const taken = await User.findOne({ googleId: identity.providerId, _id: { $ne: user._id } });
    if (taken) throw errors.conflict("This Google account is already in use.");
    user.googleId = identity.providerId;
    if (!user.name) user.name = name;
    else if (name && user.name === user.email.split("@")[0]) user.name = name;
    if (identity.pictureUrl && !user.pictureUrl) user.pictureUrl = identity.pictureUrl;
    await user.save();
  }

  const token = signUserToken({ id: user.id as string, role: user.role });
  return { token, user: publicUser({ id: user.id as string, email: user.email, name: user.name, role: user.role }) };
}

export const setRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export async function setAccountRole(userId: string, role: UserRole) {
  const user = await User.findById(userId);
  if (!user) throw errors.notFound("Account not found");
  const firstTime = !user.role;
  if (user.role && user.role !== role) {
    throw errors.badRequest("This account already has a role. It cannot be changed.");
  }
  if (firstTime) {
    user.role = role;
    await user.save();
  }

  const token = signUserToken({ id: user.id as string, role: user.role });
  return { token, user: publicUser({ id: user.id as string, email: user.email, name: user.name, role: user.role }) };
}

export function googleAuthorizationUrl(state: string) {
  if (!hasGoogleOAuth()) {
    throw errors.badRequest(
      "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then add the redirect URI on the Google Cloud OAuth client.",
    );
  }
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !json.access_token) {
    throw errors.badRequest(json.error_description || json.error || "Google did not issue an access token.");
  }
  return json.access_token;
}

export async function googleUserinfo(accessToken: string): Promise<OauthIdentity> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const info = (await response.json().catch(() => ({}))) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!response.ok || !info.sub) {
    throw errors.badRequest("Google did not return an identity for this sign-in.");
  }
  if (!info.email) {
    throw errors.badRequest("Google did not return an email. Grant the email scope and try again.");
  }
  return {
    provider: "google",
    providerId: info.sub,
    email: info.email,
    name: info.name || "",
    pictureUrl: info.picture,
  };
}

