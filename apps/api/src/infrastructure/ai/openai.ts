import OpenAI from "openai";
import { config } from "../../config.ts";
import { errors } from "../../common/errors.ts";

let client: OpenAI | null = null;

export function hasOpenAI(): boolean {
  return Boolean(config.openaiApiKey);
}

function getOpenAI(): OpenAI {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: config.openaiEmbeddingModel,
    input: texts,
  });
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function completeJson(system: string, user: string): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("The model returned an empty response");
  }
  return content;
}

export async function completeJsonParsed<T>(
  schema: { parse: (value: unknown) => T },
  system: string,
  user: string,
): Promise<T> {
  const raw = await completeJson(
    `${system}\nReturn only JSON that matches the requested fields. If a value is not supported by the provided source, use an empty string, empty array, or null. Never invent analytics, follower counts, or revenue.`,
    user,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw errors.badRequest("The model returned invalid JSON");
  }
  try {
    return schema.parse(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "The model returned data we could not store";
    throw errors.badRequest(message);
  }
}

export type ChatToolSpec = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    additionalProperties?: boolean;
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export async function chatWithTools(input: {
  messages: ChatMessage[];
  tools: ChatToolSpec[];
}): Promise<{
  content: string | null;
  toolCalls: NonNullable<ChatMessage["tool_calls"]>;
}> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: input.messages as never,
    tools: input.tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
  });
  const message = response.choices[0]?.message;
  const toolCalls = (message?.tool_calls ?? [])
    .filter((call) => call.type === "function")
    .map((call) => ({
      id: call.id,
      type: "function" as const,
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    }));
  return { content: message?.content ?? null, toolCalls };
}
