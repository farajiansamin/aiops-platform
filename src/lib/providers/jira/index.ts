import type { ToolProvider } from "../base";
import { createJiraTools } from "./tools";
import { env } from "@/lib/env";
import * as jiraClient from "./client";

export class JiraProvider implements ToolProvider {
  readonly name = "jira";
  readonly description =
    "JIRA integration for searching, creating, and updating issues to track incidents and tasks.";

  getTools() {
    return createJiraTools();
  }

  async healthCheck(): Promise<boolean> {
    if (!env.ATLASSIAN_HOST || !env.ATLASSIAN_API_TOKEN) return false;
    try {
      await jiraClient.searchIssues("order by created DESC", 1);
      return true;
    } catch {
      return false;
    }
  }
}

export const jiraProvider = new JiraProvider();
