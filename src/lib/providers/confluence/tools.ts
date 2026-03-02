import { tool } from "ai";
import { z } from "zod/v4";
import * as confluenceClient from "./client";

export function createConfluenceTools() {
  return {
    search_pages: tool({
      description:
        "Search Confluence pages using CQL. Useful for finding FAQ entries, runbooks, and documentation.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            'CQL query or text search (e.g., \'type=page AND text ~ "image resizing"\')',
          ),
        limit: z.number().optional().default(10),
      }),
      execute: async ({ query, limit }) => {
        const cql = query.includes("=")
          ? query
          : `type=page AND text ~ "${query}"`;
        const result = await confluenceClient.searchPages(cql, limit);
        return {
          total: result.totalSize,
          pages: result.results.map((p) => ({
            id: p.id,
            title: p.title,
            space: p.space.key,
            url: p._links.webui,
          })),
        };
      },
    }),

    get_page: tool({
      description:
        "Get the full content of a Confluence page by ID. Returns the page title, body, and metadata.",
      inputSchema: z.object({
        pageId: z.string().describe("Confluence page ID"),
      }),
      execute: async ({ pageId }) => {
        const page = await confluenceClient.getPage(pageId);
        return {
          id: page.id,
          title: page.title,
          space: page.space.key,
          version: page.version.number,
          body: page.body?.storage?.value ?? "",
          url: page._links.webui,
        };
      },
    }),

    create_page: tool({
      description:
        "Create a new Confluence page. Useful for drafting FAQ entries or post-mortem documents.",
      inputSchema: z.object({
        spaceKey: z.string().describe("Confluence space key"),
        title: z.string().describe("Page title"),
        body: z
          .string()
          .describe("Page body in Confluence storage format (HTML)"),
        parentId: z
          .string()
          .optional()
          .describe("Parent page ID for nesting"),
      }),
      execute: async ({ spaceKey, title, body, parentId }) => {
        const page = await confluenceClient.createPage({
          spaceKey,
          title,
          body,
          parentId,
        });
        return {
          success: true,
          id: page.id,
          title: page.title,
          url: page._links.webui,
        };
      },
    }),

    update_page: tool({
      description: "Update an existing Confluence page's content.",
      inputSchema: z.object({
        pageId: z.string().describe("Confluence page ID"),
        title: z.string().describe("Updated page title"),
        body: z.string().describe("Updated page body (HTML storage format)"),
        currentVersion: z
          .number()
          .describe("Current page version number (for optimistic locking)"),
      }),
      execute: async ({ pageId, title, body, currentVersion }) => {
        const page = await confluenceClient.updatePage({
          pageId,
          title,
          body,
          version: currentVersion,
        });
        return {
          success: true,
          id: page.id,
          version: page.version.number,
        };
      },
    }),
  };
}
