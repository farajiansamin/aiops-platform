import type { ToolProvider } from "../base";
import { createConfluenceTools } from "./tools";
import { env } from "@/lib/env";
import * as confluenceClient from "./client";

export class ConfluenceProvider implements ToolProvider {
  readonly name = "confluence";
  readonly description =
    "Confluence integration for searching and managing FAQ pages, runbooks, and post-mortem documents.";

  getTools() {
    return createConfluenceTools();
  }

  async healthCheck(): Promise<boolean> {
    const host = env.CONFLUENCE_HOST ?? env.ATLASSIAN_HOST;
    if (!host || !env.ATLASSIAN_API_TOKEN) return false;
    try {
      await confluenceClient.searchPages("type=page", 1);
      return true;
    } catch {
      return false;
    }
  }
}

export const confluenceProvider = new ConfluenceProvider();
