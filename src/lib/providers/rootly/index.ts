import type { ToolProvider } from "../base";
import { createRootlyTools } from "./tools";
import { env } from "@/lib/env";
import * as rootlyClient from "./client";

export class RootlyProvider implements ToolProvider {
  readonly name = "rootly";
  readonly description =
    "Rootly incident management integration for searching incidents, getting details, and timeline events.";

  getTools() {
    return createRootlyTools();
  }

  async healthCheck(): Promise<boolean> {
    if (!env.ROOTLY_API_TOKEN) return false;
    try {
      await rootlyClient.searchIncidents({ statuses: ["started"] });
      return true;
    } catch {
      return false;
    }
  }
}

export const rootlyProvider = new RootlyProvider();
