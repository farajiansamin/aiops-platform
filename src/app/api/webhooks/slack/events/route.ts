import { NextRequest, NextResponse } from "next/server";
import { verifySlackRequest } from "@/lib/slack-verify";
import { runInfraTriage } from "@/lib/workflows/infra-triage";
import { getModel } from "@/lib/agent";
import { env } from "@/lib/env";

const INFRA_CHANNEL_IDS = new Set(
  (process.env.SLACK_INFRA_CHANNEL_IDS ?? "").split(",").filter(Boolean),
);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (env.SLACK_SIGNING_SECRET && !verifySlackRequest(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type !== "event_callback") {
    return NextResponse.json({ ok: true });
  }

  const event = payload.event;

  if (
    event.type === "message" &&
    !event.subtype &&
    !event.bot_id &&
    (INFRA_CHANNEL_IDS.has(event.channel) || INFRA_CHANNEL_IDS.size === 0)
  ) {
    processInfraMessage(event).catch((err) =>
      console.error("Error processing infra message:", err),
    );
  }

  return NextResponse.json({ ok: true });
}

async function processInfraMessage(event: {
  text: string;
  channel: string;
  ts: string;
  user: string;
  thread_ts?: string;
}) {
  const model = getModel();
  await runInfraTriage(
    event.text,
    event.channel,
    event.thread_ts ?? event.ts,
    event.user,
    model,
  );
}
