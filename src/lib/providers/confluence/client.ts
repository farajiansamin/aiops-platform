import { env } from "@/lib/env";
import type { ConfluencePage, ConfluenceSearchResult } from "./types";

function authHeader(): string {
  return `Basic ${Buffer.from(`${env.ATLASSIAN_EMAIL}:${env.ATLASSIAN_API_TOKEN}`).toString("base64")}`;
}

function baseUrl(): string {
  const raw = env.CONFLUENCE_HOST ?? env.ATLASSIAN_HOST ?? "";
  const host = raw.replace(/^https?:\/\//, "");
  return `https://${host}/wiki/rest/api`;
}

async function fetchConfluence<T>(
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
    throw new Error(`Confluence API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function searchPages(
  cql: string,
  limit = 10,
): Promise<ConfluenceSearchResult> {
  return fetchConfluence<ConfluenceSearchResult>(
    `/content/search?cql=${encodeURIComponent(cql)}&limit=${limit}&expand=space,version`,
  );
}

export async function getPage(
  pageId: string,
  expand = "body.storage,version,space",
): Promise<ConfluencePage> {
  return fetchConfluence<ConfluencePage>(
    `/content/${pageId}?expand=${expand}`,
  );
}

export async function createPage(params: {
  spaceKey: string;
  title: string;
  body: string;
  parentId?: string;
}): Promise<ConfluencePage> {
  const payload: Record<string, unknown> = {
    type: "page",
    title: params.title,
    space: { key: params.spaceKey },
    body: {
      storage: { value: params.body, representation: "storage" },
    },
  };
  if (params.parentId) {
    payload.ancestors = [{ id: params.parentId }];
  }
  return fetchConfluence<ConfluencePage>("/content", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePage(params: {
  pageId: string;
  title: string;
  body: string;
  version: number;
}): Promise<ConfluencePage> {
  return fetchConfluence<ConfluencePage>(`/content/${params.pageId}`, {
    method: "PUT",
    body: JSON.stringify({
      type: "page",
      title: params.title,
      version: { number: params.version + 1 },
      body: {
        storage: { value: params.body, representation: "storage" },
      },
    }),
  });
}
