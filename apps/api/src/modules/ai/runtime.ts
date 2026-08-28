import type { AiPageContext } from "@naano/shared";
import { errors } from "../../common/errors.ts";
import {
  chatWithTools,
  hasOpenAI,
  type ChatMessage,
} from "../../infrastructure/ai/openai.ts";
import { AiConversation, AiMessage } from "./ai.model.ts";
import { AiPendingAction } from "./pendingAction.model.ts";
import { getTool, parseToolArgs, toolsFor } from "./tools.ts";
import type { AiActor, ToolArgs } from "./types.ts";

const MAX_STEPS = 8;

function systemPrompt(actor: AiActor, context?: AiPageContext) {
  const screen = context
    ? `The user is currently on ${context.path}${
        context.campaignId ? `, campaignId=${context.campaignId}` : ""
      }${context.collaborationId ? `, collaborationId=${context.collaborationId}` : ""}${
        context.creatorId ? `, creatorId=${context.creatorId}` : ""
      }.`
    : "No page context was provided.";
  return `You are Naano, an AI-powered LinkedIn creator marketplace for ${actor.role === "BRAND" ? "brands" : "creators"}.
You help throughout the product: matching, briefs, applications, messages, analytics, and next actions.

Rules:
- Use tools to read real stored data before you answer questions about profiles, campaigns, collaborations, or numbers.
- Never invent analytics, clicks, leads, pipeline, revenue, followers, or earnings. If a tool returns zeros or empty lists, say that nothing is stored yet.
- Funnel order is creator → post → tracking link/pixel → click → lead → pipeline → revenue. Only those stored event types count.
- Write tools (create, apply, invite, accept, reject, send, update) propose an action. Tell the user it waits for their confirmation. Do not claim it already happened.
- Draft tools return copy the user can edit. They do not send or save.
- Prefer short, specific answers with reasons grounded in tool output.
- ${screen}`;
}

function toChatMessages(
  system: string,
  stored: Array<{
    role: string;
    content: string;
    toolCallId?: string;
    name?: string;
    toolCalls?: ChatMessage["tool_calls"];
  }>,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const item of stored) {
    if (item.role === "tool") {
      messages.push({
        role: "tool",
        content: item.content,
        tool_call_id: item.toolCallId,
        name: item.name,
      });
      continue;
    }
    if (item.role === "assistant" || item.role === "user" || item.role === "system") {
      messages.push({
        role: item.role,
        content: item.content,
        tool_calls: item.toolCalls,
      });
    }
  }
  return messages;
}

export async function getOrCreateConversation(actor: AiActor) {
  let conversation = await AiConversation.findOne({ userId: actor.id, context: actor.role }).sort({
    updatedAt: -1,
  });
  if (!conversation) {
    conversation = await AiConversation.create({
      userId: actor.id,
      context: actor.role,
      title: "Naano",
    });
  }
  return conversation;
}

export async function listVisibleMessages(conversationId: string, userId: string) {
  const conversation = await AiConversation.findById(conversationId);
  if (!conversation || String(conversation.userId) !== userId) {
    throw errors.notFound("Conversation not found");
  }
  const messages = await AiMessage.find({
    conversationId,
    role: { $in: ["user", "assistant"] },
  }).sort({ createdAt: 1 });
  const pending = await AiPendingAction.find({
    conversationId,
    userId,
    status: "PENDING",
  }).sort({ createdAt: -1 });
  return {
    conversation: { id: String(conversation._id), title: conversation.title },
    messages: messages.map((message) => ({
      id: String(message._id),
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
    pendingActions: pending.map(serializeAction),
  };
}

function serializeAction(action: InstanceType<typeof AiPendingAction>) {
  return {
    id: String(action._id),
    toolName: action.toolName,
    summary: action.summary,
    args: action.args,
    status: action.status,
    result: action.result ?? null,
    error: action.error ?? null,
  };
}

export async function runTurn(actor: AiActor, input: { message: string; context?: AiPageContext }) {
  if (!hasOpenAI()) {
    throw errors.badRequest("OPENAI_API_KEY is not set, so Naano cannot reason yet. The rest of the product still uses stored data.");
  }
  const text = input.message.trim();
  if (text.length < 1) throw errors.badRequest("Say what you want Naano to do");

  const conversation = await getOrCreateConversation(actor);
  if (conversation.title === "Naano") {
    conversation.title = text.slice(0, 80);
    await conversation.save();
  }

  await AiMessage.create({
    conversationId: conversation._id,
    role: "user",
    content: text,
  });

  const history = await AiMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).limit(80);
  const available = toolsFor(actor.role);
  const chatMessages = toChatMessages(systemPrompt(actor, input.context), history);
  const pendingActions: ReturnType<typeof serializeAction>[] = [];
  let finalContent = "";

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const reply = await chatWithTools({
      messages: chatMessages,
      tools: available.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    });

    if (!reply.toolCalls.length) {
      finalContent = reply.content?.trim() || "I need a bit more detail to help with that.";
      await AiMessage.create({
        conversationId: conversation._id,
        role: "assistant",
        content: finalContent,
      });
      break;
    }

    await AiMessage.create({
      conversationId: conversation._id,
      role: "assistant",
      content: reply.content ?? "",
      toolCalls: reply.toolCalls,
    });
    chatMessages.push({
      role: "assistant",
      content: reply.content,
      tool_calls: reply.toolCalls,
    });

    for (const call of reply.toolCalls) {
      const tool = getTool(call.function.name, actor.role);
      let payload:
        | { ok: false; error: string }
        | { ok: true; data: object | string | number | boolean | null }
        | {
            ok: true;
            needsConfirmation: true;
            action: ReturnType<typeof serializeAction>;
            note: string;
          }
        | undefined;
      if (!tool) {
        payload = { ok: false, error: `Unknown or forbidden tool ${call.function.name}` };
      } else {
        let args: ToolArgs = {};
        try {
          args = parseToolArgs(tool, JSON.parse(call.function.arguments || "{}") as unknown);
        } catch (err) {
          payload = {
            ok: false,
            error: err instanceof Error ? err.message : "Invalid tool arguments",
          };
        }
        if (!payload) {
          if (tool.kind === "write") {
            const action = await AiPendingAction.create({
              userId: actor.id,
              conversationId: conversation._id,
              toolName: tool.name,
              args,
              summary: tool.summary(args),
              status: "PENDING",
            });
            const serialized = serializeAction(action);
            pendingActions.push(serialized);
            payload = {
              ok: true,
              needsConfirmation: true,
              action: serialized,
              note: "Nothing was changed yet. The user must confirm this action in the UI.",
            };
          } else {
            payload = await tool.execute(actor, args);
          }
        }
      }
      const content = JSON.stringify(payload);
      await AiMessage.create({
        conversationId: conversation._id,
        role: "tool",
        name: call.function.name,
        toolCallId: call.id,
        content,
      });
      chatMessages.push({
        role: "tool",
        name: call.function.name,
        tool_call_id: call.id,
        content,
      });
    }

    if (step === MAX_STEPS - 1) {
      finalContent = "I reached the tool step limit. Confirm any proposed actions, or ask me to continue.";
      await AiMessage.create({
        conversationId: conversation._id,
        role: "assistant",
        content: finalContent,
      });
    }
  }

  conversation.updatedAt = new Date();
  await conversation.save();

  return {
    conversation: { id: String(conversation._id), title: conversation.title },
    reply: finalContent,
    pendingActions,
  };
}

export async function confirmAction(actor: AiActor, actionId: string) {
  const action = await AiPendingAction.findById(actionId);
  if (!action || String(action.userId) !== actor.id) throw errors.notFound("Action not found");
  if (action.status !== "PENDING") throw errors.badRequest("This action is no longer pending");
  const tool = getTool(action.toolName, actor.role);
  if (!tool || tool.kind !== "write") throw errors.badRequest("This action cannot be confirmed");
  const result = await tool.execute(actor, action.args);
  if (!result.ok) {
    action.status = "PENDING";
    action.result = result;
    action.error = result.error;
    await action.save();
    throw errors.badRequest(action.error);
  }
  action.status = "CONFIRMED";
  action.result = result;
  action.error = undefined;
  await action.save();
  if (action.conversationId) {
    await AiMessage.create({
      conversationId: action.conversationId,
      role: "assistant",
      content: `Done: ${action.summary}.`,
    });
  }
  return serializeAction(action);
}

export async function cancelAction(actor: AiActor, actionId: string) {
  const action = await AiPendingAction.findById(actionId);
  if (!action || String(action.userId) !== actor.id) throw errors.notFound("Action not found");
  if (action.status !== "PENDING") throw errors.badRequest("This action is no longer pending");
  action.status = "CANCELLED";
  await action.save();
  return serializeAction(action);
}
