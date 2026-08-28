import type { CampaignStatus, CollaborationStatus, FunnelEventType, UserRole } from "@naano/shared";
import type { z } from "zod";

export type AiActor = {
  id: string;
  name: string;
  role: UserRole;
};

type AiToolKind = "read" | "draft" | "write";

/** Parsed tool arguments after Zod. Union of fields every Naano tool actually accepts. */
export type ToolArgs = {
  campaignId?: string;
  collaborationId?: string;
  creatorId?: string;
  creatorUserId?: string;
  applicationId?: string;
  query?: string;
  intent?: string;
  instruction?: string;
  pitch?: string;
  body?: string;
  linkedInUrl?: string;
  xUrl?: string;
  headline?: string;
  bio?: string;
  positioning?: string;
  status?: CampaignStatus | CollaborationStatus;
  contentUrl?: string;
  publishedUrl?: string;
  contentNotes?: string;
  type?: FunnelEventType;
  amount?: number;
  note?: string;
  title?: string;
  description?: string;
  goal?: string;
  targetAudience?: string;
  industry?: string;
  platform?: string;
  pricePerPost?: number;
  deliverables?: string[] | string;
  requirements?: string;
  budget?: number;
  currency?: string;
  deadline?: string;
  landingUrl?: string;
};

export type ToolOutcome<T = object | string | number | boolean | null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type JsonSchemaProperty = {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  enum?: string[];
};

export type JsonSchemaObject = {
  type: "object";
  additionalProperties: boolean;
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
};

export type AiTool = {
  name: string;
  description: string;
  roles: UserRole[];
  kind: AiToolKind;
  input: z.ZodType<ToolArgs>;
  parameters: JsonSchemaObject;
  summary: (args: ToolArgs) => string;
  execute: (actor: AiActor, args: ToolArgs) => Promise<ToolOutcome>;
};

export function objectParams(
  properties: Record<string, JsonSchemaProperty>,
  required: string[] = [],
): JsonSchemaObject {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

export function str(description: string): JsonSchemaProperty {
  return { type: "string", description };
}
