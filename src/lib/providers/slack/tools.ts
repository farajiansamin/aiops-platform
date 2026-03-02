import { tool } from "ai";
import { z } from "zod/v4";
import * as slackClient from "./client";

export function createSlackTools() {
  return {
    post_message: tool({
      description:
        "Post a message to a Slack channel, optionally in a thread. Supports Block Kit blocks.",
      inputSchema: z.object({
        channel: z.string().describe("Slack channel ID"),
        text: z.string().describe("Message text (fallback for blocks)"),
        threadTs: z
          .string()
          .optional()
          .describe("Thread timestamp to reply in"),
        blocks: z
          .array(z.record(z.string(), z.unknown()))
          .optional()
          .describe("Slack Block Kit blocks"),
      }),
      execute: async ({ channel, text, threadTs, blocks }) => {
        const result = await slackClient.postMessage(channel, text, {
          threadTs,
          blocks,
        });
        return result
          ? { success: true, ts: result.ts }
          : { success: false, error: "Failed to post message" };
      },
    }),

    update_message: tool({
      description: "Update an existing Slack message.",
      inputSchema: z.object({
        channel: z.string().describe("Slack channel ID"),
        ts: z.string().describe("Message timestamp to update"),
        text: z.string().describe("Updated message text"),
        blocks: z
          .array(z.record(z.string(), z.unknown()))
          .optional()
          .describe("Updated Block Kit blocks"),
      }),
      execute: async ({ channel, ts, text, blocks }) => {
        const success = await slackClient.updateMessage(
          channel,
          ts,
          text,
          blocks,
        );
        return { success };
      },
    }),

    search_messages: tool({
      description:
        "Search Slack messages across channels. Useful for finding historical discussions about a service or error.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search query (supports Slack search syntax like 'in:#channel from:@user')",
          ),
        count: z
          .number()
          .optional()
          .default(20)
          .describe("Max results to return"),
      }),
      execute: async ({ query, count }) => {
        const messages = await slackClient.searchMessages(query, { count });
        return {
          total: messages.length,
          messages: messages.map((m) => ({
            text: m.text,
            user: m.user,
            channel: m.channel,
            ts: m.ts,
            threadTs: m.threadTs,
          })),
        };
      },
    }),

    fetch_channel_history: tool({
      description:
        "Fetch recent messages from a Slack channel. Used for reading alert channels and finding related events.",
      inputSchema: z.object({
        channel: z.string().describe("Slack channel ID"),
        minutesAgo: z
          .number()
          .optional()
          .default(60)
          .describe("How many minutes back to fetch"),
        limit: z
          .number()
          .optional()
          .default(200)
          .describe("Max messages to fetch"),
      }),
      execute: async ({ channel, minutesAgo, limit }) => {
        const oldest = String(
          Math.floor(Date.now() / 1000) - minutesAgo * 60,
        );
        const history = await slackClient.fetchChannelHistory(
          channel,
          oldest,
          limit,
        );
        return {
          messageCount: history.messages.length,
          hasMore: history.hasMore,
          messages: history.messages.map((m) => ({
            text: m.text,
            user: m.user,
            ts: m.ts,
          })),
        };
      },
    }),

    fetch_thread: tool({
      description:
        "Fetch all replies in a Slack thread. Useful for reading full discussion context.",
      inputSchema: z.object({
        channel: z.string().describe("Slack channel ID"),
        threadTs: z.string().describe("Thread parent message timestamp"),
      }),
      execute: async ({ channel, threadTs }) => {
        const replies = await slackClient.fetchThreadReplies(
          channel,
          threadTs,
        );
        return {
          replyCount: replies.length,
          messages: replies.map((m) => ({
            text: m.text,
            user: m.user,
            ts: m.ts,
          })),
        };
      },
    }),
  };
}
