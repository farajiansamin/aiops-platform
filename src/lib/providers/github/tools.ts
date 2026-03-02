import { tool } from "ai";
import { z } from "zod/v4";
import * as githubClient from "./client";

export function createGitHubTools() {
  return {
    list_recent_prs: tool({
      description:
        "List recently merged PRs for a GitHub repo. Filters by time window to find changes that may have caused issues.",
      inputSchema: z.object({
        owner: z.string().describe("GitHub org or user"),
        repo: z.string().describe("Repository name"),
        hoursAgo: z
          .number()
          .optional()
          .default(4)
          .describe("How many hours back to search for merged PRs"),
        baseBranch: z
          .string()
          .optional()
          .describe("Base branch to filter (e.g., main)"),
      }),
      execute: async ({ owner, repo, hoursAgo, baseBranch }) => {
        const mergedAfter = new Date(
          Date.now() - hoursAgo * 60 * 60 * 1000,
        ).toISOString();
        const prs = await githubClient.listRecentPRs(owner, repo, {
          mergedAfter,
          baseBranch,
        });
        return {
          count: prs.length,
          prs: prs.map((pr) => ({
            number: pr.number,
            title: pr.title,
            author: pr.user.login,
            mergedAt: pr.mergedAt,
            url: pr.htmlUrl,
            commitSha: pr.mergeCommitSha,
            filesChanged: pr.changedFiles,
            additions: pr.additions,
            deletions: pr.deletions,
          })),
        };
      },
    }),

    get_pr_details: tool({
      description:
        "Get full details of a pull request including changed files, diff stats, and reviewers.",
      inputSchema: z.object({
        owner: z.string().describe("GitHub org or user"),
        repo: z.string().describe("Repository name"),
        prNumber: z.number().describe("Pull request number"),
      }),
      execute: async ({ owner, repo, prNumber }) => {
        const pr = await githubClient.getPRDetails(owner, repo, prNumber);
        return {
          number: pr.number,
          title: pr.title,
          body: pr.body?.slice(0, 500),
          author: pr.user.login,
          merged: pr.merged,
          mergedAt: pr.mergedAt,
          url: pr.htmlUrl,
          commitSha: pr.mergeCommitSha,
          stats: {
            filesChanged: pr.changedFiles,
            additions: pr.additions,
            deletions: pr.deletions,
          },
          files: pr.files.slice(0, 20).map((f) => ({
            filename: f.filename,
            status: f.status,
            changes: f.changes,
          })),
          labels: pr.labels.map((l) => l.name),
        };
      },
    }),

    get_recent_commits: tool({
      description:
        "Get recent commits on a branch within a time window, with author info and commit messages.",
      inputSchema: z.object({
        owner: z.string().describe("GitHub org or user"),
        repo: z.string().describe("Repository name"),
        branch: z
          .string()
          .optional()
          .default("main")
          .describe("Branch name"),
        hoursAgo: z.number().optional().default(4),
      }),
      execute: async ({ owner, repo, branch, hoursAgo }) => {
        const since = new Date(
          Date.now() - hoursAgo * 60 * 60 * 1000,
        ).toISOString();
        const commits = await githubClient.getRecentCommits(owner, repo, {
          branch,
          since,
        });
        return {
          count: commits.length,
          commits: commits.map((c) => ({
            sha: c.sha.slice(0, 7),
            fullSha: c.sha,
            message: c.message.split("\n")[0],
            author: c.author.login,
            date: c.author.date,
            url: c.htmlUrl,
          })),
        };
      },
    }),

    get_commit_diff: tool({
      description:
        "Get the actual diff for a specific commit so the agent can reason about what changed.",
      inputSchema: z.object({
        owner: z.string().describe("GitHub org or user"),
        repo: z.string().describe("Repository name"),
        sha: z.string().describe("Commit SHA"),
      }),
      execute: async ({ owner, repo, sha }) => {
        const commit = await githubClient.getCommitDiff(owner, repo, sha);
        return {
          sha: commit.sha.slice(0, 7),
          message: commit.message,
          author: commit.author.login,
          url: commit.htmlUrl,
          stats: commit.stats,
          files: commit.files?.slice(0, 20),
        };
      },
    }),

    search_code: tool({
      description:
        "Search code across GitHub repos in the organization. Useful for finding which repo owns a Terraform resource or service.",
      inputSchema: z.object({
        query: z
          .string()
          .describe("Code search query (e.g., 'resource aws_vpc module')"),
        org: z
          .string()
          .optional()
          .describe(
            "GitHub org to scope the search to (uses GITHUB_ORG env var if not provided)",
          ),
      }),
      execute: async ({ query, org }) => {
        const result = await githubClient.searchCode(query, org);
        return {
          totalCount: result.totalCount,
          results: result.items.map((item) => ({
            file: item.path,
            repo: item.repository.full_name,
            url: item.htmlUrl,
          })),
        };
      },
    }),

    list_deployments: tool({
      description:
        "List recent deployments for a repo. Correlate deploy times with incident start.",
      inputSchema: z.object({
        owner: z.string().describe("GitHub org or user"),
        repo: z.string().describe("Repository name"),
        environment: z
          .string()
          .optional()
          .describe("Filter by environment (e.g., production)"),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ owner, repo, environment, limit }) => {
        const deployments = await githubClient.listDeployments(owner, repo, {
          environment,
          limit,
        });
        return {
          count: deployments.length,
          deployments: deployments.map((d) => ({
            id: d.id,
            environment: d.environment,
            ref: d.ref,
            sha: d.sha.slice(0, 7),
            creator: d.creator.login,
            createdAt: d.createdAt,
            description: d.description,
          })),
        };
      },
    }),
  };
}
