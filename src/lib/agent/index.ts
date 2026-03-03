import { streamText, type LanguageModel, type ModelMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";
import { SYSTEM_PROMPT } from "./prompts/system";
import { getAllTools } from "./tools";

export type AgentContext = "general" | "infra-triage" | "customer-impact" | "postmortem";

export function getModel(): LanguageModel {
  if (env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    return openai("gpt-4o");
  }
  if (env.ANTHROPIC_API_KEY) {
    const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });
    return anthropic("claude-sonnet-4-20250514");
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google("gemini-2.5-flash");
  }
  throw new Error(
    "No LLM API key configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
  );
}

async function getContextPrompt(context: AgentContext): Promise<string> {
  switch (context) {
    case "infra-triage": {
      const { INFRA_TRIAGE_PROMPT } = await import("./prompts/infra-triage");
      return `${SYSTEM_PROMPT}\n\n${INFRA_TRIAGE_PROMPT}`;
    }
    case "customer-impact": {
      const { CUSTOMER_IMPACT_PROMPT } = await import(
        "./prompts/customer-impact"
      );
      return `${SYSTEM_PROMPT}\n\n${CUSTOMER_IMPACT_PROMPT}`;
    }
    case "postmortem": {
      const { POSTMORTEM_PROMPT } = await import("./prompts/postmortem");
      return `${SYSTEM_PROMPT}\n\n${POSTMORTEM_PROMPT}`;
    }
    default:
      return SYSTEM_PROMPT;
  }
}

export async function runAgent(params: {
  messages: ModelMessage[];
  context?: AgentContext;
}) {
  const model = getModel();
  const systemPrompt = await getContextPrompt(params.context ?? "general");
  const tools = getAllTools();

  return streamText({
    model,
    system: systemPrompt,
    messages: params.messages,
    tools,
  });
}
