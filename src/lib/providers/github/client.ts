import { Octokit } from "octokit";
import { env } from "@/lib/env";
import type {
  GitHubPR,
  GitHubCommit,
  GitHubDeployment,
  GitHubCodeSearchResult,
} from "./types";

let octokitInstance: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokitInstance) {
    octokitInstance = new Octokit({ auth: env.GITHUB_TOKEN });
  }
  return octokitInstance;
}

export async function listRecentPRs(
  owner: string,
  repo: string,
  options?: {
    mergedAfter?: string;
    baseBranch?: string;
    limit?: number;
  },
): Promise<GitHubPR[]> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: options?.limit ?? 20,
    base: options?.baseBranch,
  });

  let prs = data.filter((pr) => pr.merged_at !== null);

  if (options?.mergedAfter) {
    const cutoff = new Date(options.mergedAfter).getTime();
    prs = prs.filter(
      (pr) => new Date(pr.merged_at!).getTime() >= cutoff,
    );
  }

  return prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    merged: true,
    mergedAt: pr.merged_at,
    user: { login: pr.user?.login ?? "unknown" },
    htmlUrl: pr.html_url,
    mergeCommitSha: pr.merge_commit_sha ?? null,
    changedFiles: 0,
    additions: 0,
    deletions: 0,
    labels: pr.labels.map((l) => ({ name: l.name ?? "" })),
    base: { ref: pr.base.ref },
  }));
}

export async function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPR & { files: Array<{ filename: string; status: string; changes: number }> }> {
  const octokit = getOctokit();
  const [{ data: pr }, { data: files }] = await Promise.all([
    octokit.rest.pulls.get({ owner, repo, pull_number: prNumber }),
    octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 50,
    }),
  ]);

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    merged: pr.merged,
    mergedAt: pr.merged_at,
    user: { login: pr.user?.login ?? "unknown" },
    htmlUrl: pr.html_url,
    mergeCommitSha: pr.merge_commit_sha ?? null,
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
    labels: pr.labels.map((l) => ({ name: l.name ?? "" })),
    base: { ref: pr.base.ref },
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      changes: f.changes,
    })),
  };
}

export async function getRecentCommits(
  owner: string,
  repo: string,
  options?: { branch?: string; since?: string; limit?: number },
): Promise<GitHubCommit[]> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: options?.branch,
    since: options?.since,
    per_page: options?.limit ?? 20,
  });

  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: {
      login: c.author?.login ?? c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? "",
    },
    htmlUrl: c.html_url,
  }));
}

export async function getCommitDiff(
  owner: string,
  repo: string,
  sha: string,
): Promise<GitHubCommit> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });

  return {
    sha: data.sha,
    message: data.commit.message,
    author: {
      login: data.author?.login ?? data.commit.author?.name ?? "unknown",
      date: data.commit.author?.date ?? "",
    },
    htmlUrl: data.html_url,
    stats: data.stats
      ? {
          additions: data.stats.additions ?? 0,
          deletions: data.stats.deletions ?? 0,
          total: data.stats.total ?? 0,
        }
      : undefined,
    files: data.files?.map((f) => ({
      filename: f.filename,
      status: f.status ?? "modified",
      changes: f.changes,
    })),
  };
}

export async function searchCode(
  query: string,
  org?: string,
): Promise<GitHubCodeSearchResult> {
  const octokit = getOctokit();
  const fullQuery = org ? `${query} org:${org}` : query;
  const { data } = await octokit.rest.search.code({
    q: fullQuery,
    per_page: 10,
  });

  return {
    totalCount: data.total_count,
    items: data.items.map((item) => ({
      name: item.name,
      path: item.path,
      htmlUrl: item.html_url,
      repository: { full_name: item.repository.full_name },
    })),
  };
}

export async function listDeployments(
  owner: string,
  repo: string,
  options?: { environment?: string; limit?: number },
): Promise<GitHubDeployment[]> {
  const octokit = getOctokit();
  const { data } = await octokit.rest.repos.listDeployments({
    owner,
    repo,
    environment: options?.environment,
    per_page: options?.limit ?? 10,
  });

  return data.map((d) => ({
    id: d.id,
    environment: d.environment,
    ref: d.ref,
    sha: d.sha,
    creator: { login: d.creator?.login ?? "unknown" },
    createdAt: d.created_at,
    description: d.description,
  }));
}
