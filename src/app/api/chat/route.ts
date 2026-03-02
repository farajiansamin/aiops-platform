import { runAgent, type AgentContext } from "@/lib/agent";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { messages, context } = await request.json();

  const result = await runAgent({
    messages,
    context: (context as AgentContext) ?? "general",
  });

  return result.toUIMessageStreamResponse();
}
