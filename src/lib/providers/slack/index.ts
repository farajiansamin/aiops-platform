import type { ToolProvider } from "../base";
import { createSlackTools } from "./tools";
import { getSlackClient } from "./client";
import { env } from "@/lib/env";

export class SlackProvider implements ToolProvider {
  readonly name = "slack";
  readonly description =
    "Slack integration for posting messages, searching history, reading threads, and interactive Block Kit UIs.";

  getTools() {
    return createSlackTools();
  }

  async healthCheck(): Promise<boolean> {
    if (!env.SLACK_BOT_TOKEN) return false;
    try {
      const client = getSlackClient();
      const result = await client.auth.test();
      return result.ok ?? false;
    } catch {
      return false;
    }
  }
}

export const slackProvider = new SlackProvider();
