import mongoose, { Schema, type Types } from "mongoose";

export type ConversationDoc = {
  collaborationId: Types.ObjectId;
  brandUserId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const conversationSchema = new Schema<ConversationDoc>(
  {
    collaborationId: {
      type: Schema.Types.ObjectId,
      ref: "Collaboration",
      required: true,
      unique: true,
    },
    brandUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export const Conversation = mongoose.model<ConversationDoc>(
  "Conversation",
  conversationSchema,
);

export type MessageDoc = {
  conversationId: Types.ObjectId;
  senderUserId: Types.ObjectId;
  body: string;
  createdAt: Date;
};

const messageSchema = new Schema<MessageDoc>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 8000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Message = mongoose.model<MessageDoc>("Message", messageSchema);
