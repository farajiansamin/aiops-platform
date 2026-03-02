import type { ToolProvider } from "../base";
import { createGitHubTools } from "./tools";
import { env } from "@/lib/env";

export class GitHubProvider implements ToolProvider {
  readonly name = "github";
  readonly description =
    "GitHub integration for RCA context: recent PRs, commits, code search, and deployments.";

  getTools() {
    return createGitHubTools();
  }

  async healthCheck(): Promise<boolean> {
    if (!env.GITHUB_TOKEN) return false;
    try {
      const { Octokit } = await import("octokit");
      const octokit = new Octokit({ auth: env.GITHUB_TOKEN });
      const { status } = await octokit.rest.users.getAuthenticated();
      return status === 200;
    } catch {
      return false;
    }
  }
}

export const githubProvider = new GitHubProvider();
