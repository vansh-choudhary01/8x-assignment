import mongoose, { Schema, type Types } from "mongoose";
import { AI_ACTION_STATUSES, type AiActionStatus } from "@naano/shared";
import type { ToolArgs, ToolOutcome } from "./types.ts";

export type AiPendingActionDoc = {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  toolName: string;
  args: ToolArgs;
  summary: string;
  status: AiActionStatus;
  result?: ToolOutcome;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

const schema = new Schema<AiPendingActionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "AiConversation" },
    toolName: { type: String, required: true },
    args: { type: Schema.Types.Mixed, required: true },
    summary: { type: String, required: true },
    status: { type: String, enum: AI_ACTION_STATUSES, default: "PENDING", index: true },
    result: Schema.Types.Mixed,
    error: String,
  },
  { timestamps: true },
);

export const AiPendingAction = mongoose.model<AiPendingActionDoc>("AiPendingAction", schema);
