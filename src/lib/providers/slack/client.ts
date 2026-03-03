import { WebClient } from "@slack/web-api";
import { env } from "@/lib/env";
import type { SlackChannelHistory, SlackMessage } from "./types";

let clientInstance: WebClient | null = null;
let userClientInstance: WebClient | null = null;

export function getSlackClient(): WebClient {
  if (!clientInstance) {
    clientInstance = new WebClient(env.SLACK_BOT_TOKEN);
  }
  return clientInstance;
}

/**
 * Returns a Slack client using the User OAuth Token.
 * Required for search.messages which is a user-token-only API.
 * Falls back to the bot token if no user token is configured
 * (search will fail but other operations still work).
 */
function getSlackUserClient(): WebClient {
  if (!userClientInstance) {
    userClientInstance = new WebClient(
      env.SLACK_USER_TOKEN ?? env.SLACK_BOT_TOKEN,
    );
  }
  return userClientInstance;
}

export async function postMessage(
  channel: string,
  text: string,
  options?: {
    threadTs?: string;
    blocks?: Record<string, unknown>[];
    unfurlLinks?: boolean;
  },
): Promise<SlackMessage | null> {
  const client = getSlackClient();
  const result = await client.chat.postMessage({
    channel,
    text,
    thread_ts: options?.threadTs,
    blocks: options?.blocks as never,
    unfurl_links: options?.unfurlLinks ?? false,
  });
  if (!result.ok || !result.ts) return null;
  return { ts: result.ts, text, user: "bot", channel };
}

export async function updateMessage(
  channel: string,
  ts: string,
  text: string,
  blocks?: Record<string, unknown>[],
): Promise<boolean> {
  const client = getSlackClient();
  const result = await client.chat.update({
    channel,
    ts,
    text,
    blocks: blocks as never,
  });
  return result.ok ?? false;
}

export async function fetchChannelHistory(
  channel: string,
  oldest?: string,
  limit = 200,
): Promise<SlackChannelHistory> {
  const client = getSlackClient();
  const result = await client.conversations.history({
    channel,
    oldest,
    limit,
    inclusive: true,
  });

  const SYSTEM_SUBTYPES = new Set([
    "channel_join",
    "channel_leave",
    "channel_topic",
    "channel_purpose",
    "channel_name",
    "channel_archive",
    "channel_unarchive",
    "group_join",
    "group_leave",
    "group_topic",
    "group_purpose",
    "group_name",
    "pinned_item",
    "unpinned_item",
  ]);

  const messages: SlackMessage[] = (result.messages ?? [])
    .filter((m) => {
      const sub = (m as Record<string, unknown>).subtype as string | undefined;
      return !sub || !SYSTEM_SUBTYPES.has(sub);
    })
    .map((m) => ({
      ts: m.ts ?? "",
      text: m.text ?? "",
      user: m.user ?? "",
      channel,
      threadTs: m.thread_ts,
    }));

  return {
    messages,
    hasMore: result.has_more ?? false,
    responseMetadata: result.response_metadata as
      | { nextCursor?: string }
      | undefined,
  };
}

export async function fetchThreadReplies(
  channel: string,
  threadTs: string,
): Promise<SlackMessage[]> {
  const client = getSlackClient();
  const result = await client.conversations.replies({
    channel,
    ts: threadTs,
  });
  return (result.messages ?? []).map((m) => ({
    ts: m.ts ?? "",
    text: m.text ?? "",
    user: m.user ?? "",
    channel,
    threadTs: m.thread_ts,
  }));
}

export async function searchMessages(
  query: string,
  options?: { count?: number; sort?: "timestamp" | "score" },
): Promise<SlackMessage[]> {
  const client = getSlackUserClient();
  const result = await client.search.messages({
    query,
    count: options?.count ?? 20,
    sort: options?.sort ?? "timestamp",
    sort_dir: "desc",
  });
  return (
    (result.messages?.matches as Array<Record<string, string>>)?.map((m) => ({
      ts: m.ts ?? "",
      text: m.text ?? "",
      user: m.user ?? "",
      channel: (m.channel as unknown as { id: string })?.id ?? "",
      threadTs: m.thread_ts,
    })) ?? []
  );
}
