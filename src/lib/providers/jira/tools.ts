import { tool } from "ai";
import { z } from "zod/v4";
import * as jiraClient from "./client";

export function createJiraTools() {
  return {
    search_issues: tool({
      description:
        "Search JIRA issues using JQL. Useful for finding related bugs, tasks, or incidents linked to a service.",
      inputSchema: z.object({
        jql: z
          .string()
          .describe(
            'JQL query string (e.g., \'project = INF AND status != Done AND text ~ "image-resizing"\')',
          ),
        maxResults: z.number().optional().default(20),
      }),
      execute: async ({ jql, maxResults }) => {
        const result = await jiraClient.searchIssues(jql, maxResults);
        return {
          total: result.total,
          issues: result.issues.map((issue) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            priority: issue.fields.priority?.name,
            assignee: issue.fields.assignee?.displayName,
            type: issue.fields.issuetype.name,
            project: issue.fields.project.key,
            created: issue.fields.created,
            updated: issue.fields.updated,
          })),
        };
      },
    }),

    get_issue: tool({
      description: "Get details of a specific JIRA issue by key.",
      inputSchema: z.object({
        issueKey: z.string().describe("JIRA issue key (e.g., INF-123)"),
      }),
      execute: async ({ issueKey }) => {
        const issue = await jiraClient.getIssue(issueKey);
        return {
          key: issue.key,
          summary: issue.fields.summary,
          description: issue.fields.description,
          status: issue.fields.status.name,
          priority: issue.fields.priority?.name,
          assignee: issue.fields.assignee?.displayName,
          reporter: issue.fields.reporter?.displayName,
          type: issue.fields.issuetype.name,
          labels: issue.fields.labels,
          created: issue.fields.created,
          updated: issue.fields.updated,
        };
      },
    }),

    create_issue: tool({
      description:
        "Create a new JIRA issue. Useful for automatically creating tickets from incidents or help requests.",
      inputSchema: z.object({
        projectKey: z.string().describe("JIRA project key (e.g., INF)"),
        summary: z.string().describe("Issue title/summary"),
        description: z.string().optional().describe("Issue description"),
        issueType: z
          .string()
          .optional()
          .default("Task")
          .describe("Issue type (Bug, Task, Story, etc.)"),
        priority: z
          .string()
          .optional()
          .describe("Priority (Highest, High, Medium, Low, Lowest)"),
        labels: z.array(z.string()).optional().describe("Labels to add"),
      }),
      execute: async ({
        projectKey,
        summary,
        description,
        issueType,
        priority,
        labels,
      }) => {
        const result = await jiraClient.createIssue({
          projectKey,
          summary,
          description,
          issueType,
          priority,
          labels,
        });
        return { success: true, key: result.key, id: result.id };
      },
    }),

    update_issue: tool({
      description: "Update fields on an existing JIRA issue.",
      inputSchema: z.object({
        issueKey: z.string().describe("JIRA issue key"),
        fields: z
          .record(z.string(), z.unknown())
          .describe("Fields to update"),
      }),
      execute: async ({ issueKey, fields }) => {
        await jiraClient.updateIssue(issueKey, fields);
        return { success: true, issueKey };
      },
    }),

    add_comment: tool({
      description: "Add a comment to a JIRA issue.",
      inputSchema: z.object({
        issueKey: z.string().describe("JIRA issue key"),
        comment: z.string().describe("Comment text"),
      }),
      execute: async ({ issueKey, comment }) => {
        await jiraClient.addComment(issueKey, comment);
        return { success: true, issueKey };
      },
    }),
  };
}
