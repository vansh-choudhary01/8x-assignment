import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@naano/shared";
import { config } from "../config.ts";
import { errors } from "../common/errors.ts";
import { User } from "../modules/users/user.model.ts";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type TokenPayload = {
  sub: string;
  role?: UserRole;
};

export function signUserToken(user: { id: string; role?: UserRole }): string {
  const payload: TokenPayload = { sub: user.id };
  if (user.role) payload.role = user.role;
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = readToken(req);
    if (!token) {
      throw errors.unauthorized();
    }
    req.user = await loadUser(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireSettledRole(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(errors.unauthorized());
    return;
  }
  if (!req.user.role) {
    next(errors.forbidden("Choose Creator or Brand before continuing"));
    return;
  }
  next();
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(errors.unauthorized());
      return;
    }
    if (!req.user.role) {
      next(errors.forbidden("Choose Creator or Brand before continuing"));
      return;
    }
    if (req.user.role !== role) {
      next(errors.forbidden("This area is for a different account type"));
      return;
    }
    next();
  };
}

function readToken(req: Request): string | undefined {
  const cookie = req.cookies?.token as string | undefined;
  if (cookie) return cookie;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}

async function loadUser(token: string): Promise<AuthUser> {
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    throw errors.unauthorized("Session expired. Sign in again.");
  }
  const user = await User.findById(payload.sub);
  if (!user) throw errors.unauthorized();
  return {
    id: user.id as string,
    email: user.email,
    name: user.name,
    role: user.role || undefined,
  };
}
