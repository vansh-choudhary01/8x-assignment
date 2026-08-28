import mongoose, { Schema, type Types } from "mongoose";

export type AiConversationDoc = {
  userId: Types.ObjectId;
  context: "BRAND" | "CREATOR";
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

const aiConversationSchema = new Schema<AiConversationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    context: { type: String, required: true, enum: ["BRAND", "CREATOR"] },
    title: { type: String, default: "New conversation" },
  },
  { timestamps: true },
);

export const AiConversation = mongoose.model<AiConversationDoc>(
  "AiConversation",
  aiConversationSchema,
);

export type StoredToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AiMessageDoc = {
  conversationId: Types.ObjectId;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
  name?: string;
  toolCalls?: StoredToolCall[];
  createdAt: Date;
};

const aiMessageSchema = new Schema<AiMessageDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AiConversation",
      required: true,
      index: true,
    },
    role: { type: String, required: true, enum: ["user", "assistant", "system", "tool"] },
    content: { type: String, default: "" },
    toolCallId: String,
    name: String,
    toolCalls: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AiMessage = mongoose.model<AiMessageDoc>("AiMessage", aiMessageSchema);
