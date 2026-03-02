export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged: boolean;
  mergedAt: string | null;
  user: { login: string };
  htmlUrl: string;
  mergeCommitSha: string | null;
  changedFiles: number;
  additions: number;
  deletions: number;
  labels: Array<{ name: string }>;
  base: { ref: string };
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: { login: string; date: string };
  htmlUrl: string;
  stats?: { additions: number; deletions: number; total: number };
  files?: Array<{ filename: string; status: string; changes: number }>;
}

export interface GitHubDeployment {
  id: number;
  environment: string;
  ref: string;
  sha: string;
  creator: { login: string };
  createdAt: string;
  description: string | null;
}

export interface GitHubCodeSearchResult {
  totalCount: number;
  items: Array<{
    name: string;
    path: string;
    htmlUrl: string;
    repository: { full_name: string };
  }>;
}
