import { errors } from "../../common/errors.ts";
import { recordEvent } from "../analytics/recordEvent.ts";
import { Collaboration } from "../collaborations/collaboration.model.ts";
import { Conversation, Message } from "./message.model.ts";

async function getConversation(collaborationId: string, userId: string) {
  const collaboration = await Collaboration.findById(collaborationId);
  if (!collaboration) throw errors.notFound("Collaboration not found");
  if (String(collaboration.brandUserId) !== userId && String(collaboration.creatorUserId) !== userId) {
    throw errors.forbidden();
  }
  let conversation = await Conversation.findOne({ collaborationId });
  if (!conversation) {
    conversation = await Conversation.create({
      collaborationId,
      brandUserId: collaboration.brandUserId,
      creatorUserId: collaboration.creatorUserId,
    });
  }
  return { conversation, collaboration };
}

export async function listMessages(collaborationId: string, userId: string) {
  const { conversation } = await getConversation(collaborationId, userId);
  return Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
}

export async function sendMessage(collaborationId: string, userId: string, body: string) {
  const { conversation, collaboration } = await getConversation(collaborationId, userId);
  const message = await Message.create({
    conversationId: conversation._id,
    senderUserId: userId,
    body,
  });
  await recordEvent({
    type: "MESSAGE_SENT",
    actorUserId: userId,
    campaignId: collaboration.campaignId,
    creatorUserId: collaboration.creatorUserId,
    collaborationId: collaboration._id,
    metadata: { messageId: String(message._id) },
  });
  return message;
}
