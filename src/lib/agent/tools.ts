import { ToolProviderRegistry } from "@/lib/providers/base";
import { slackProvider } from "@/lib/providers/slack";
import { rootlyProvider } from "@/lib/providers/rootly";
import { jiraProvider } from "@/lib/providers/jira";
import { confluenceProvider } from "@/lib/providers/confluence";
import { githubProvider } from "@/lib/providers/github";
import { env } from "@/lib/env";

let registryInstance: ToolProviderRegistry | null = null;

export function getRegistry(): ToolProviderRegistry {
  if (registryInstance) return registryInstance;

  registryInstance = new ToolProviderRegistry();

  if (env.SLACK_BOT_TOKEN) {
    registryInstance.register(slackProvider);
  }
  if (env.ROOTLY_API_TOKEN) {
    registryInstance.register(rootlyProvider);
  }
  if (env.ATLASSIAN_API_TOKEN && env.ATLASSIAN_HOST) {
    registryInstance.register(jiraProvider);
  }
  if (env.ATLASSIAN_API_TOKEN && (env.CONFLUENCE_HOST ?? env.ATLASSIAN_HOST)) {
    registryInstance.register(confluenceProvider);
  }
  if (env.GITHUB_TOKEN) {
    registryInstance.register(githubProvider);
  }

  return registryInstance;
}

export function getAllTools() {
  return getRegistry().getAll();
}
