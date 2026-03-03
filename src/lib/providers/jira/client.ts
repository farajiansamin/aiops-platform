import { env } from "@/lib/env";
import type { JiraIssue, JiraSearchResult, JiraCreateIssueInput } from "./types";

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.ATLASSIAN_EMAIL}:${env.ATLASSIAN_API_TOKEN}`).toString("base64")}`;
}

function baseUrl(): string {
  const host = (env.ATLASSIAN_HOST ?? "").replace(/^https?:\/\//, "");
  return `https://${host}/rest/api/3`;
}

async function fetchJira<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`JIRA API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function searchIssues(
  jql: string,
  maxResults = 20,
): Promise<JiraSearchResult> {
  return fetchJira<JiraSearchResult>(
    `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=summary,status,priority,assignee,reporter,created,updated,issuetype,project,labels,description`,
  );
}

export async function getIssue(issueKey: string): Promise<JiraIssue> {
  return fetchJira<JiraIssue>(`/issue/${issueKey}`);
}

export async function createIssue(
  input: JiraCreateIssueInput,
): Promise<{ id: string; key: string }> {
  const body = {
    fields: {
      project: { key: input.projectKey },
      summary: input.summary,
      issuetype: { name: input.issueType ?? "Task" },
      ...(input.description && {
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: input.description }],
            },
          ],
        },
      }),
      ...(input.priority && { priority: { name: input.priority } }),
      ...(input.labels && { labels: input.labels }),
    },
  };
  return fetchJira<{ id: string; key: string }>("/issue", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateIssue(
  issueKey: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await fetchJira(`/issue/${issueKey}`, {
    method: "PUT",
    body: JSON.stringify({ fields }),
  });
}

export async function addComment(
  issueKey: string,
  comment: string,
): Promise<void> {
  await fetchJira(`/issue/${issueKey}/comment`, {
    method: "POST",
    body: JSON.stringify({
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: comment }],
          },
        ],
      },
    }),
  });
}
