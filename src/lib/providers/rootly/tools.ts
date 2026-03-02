import { tool } from "ai";
import { z } from "zod/v4";
import * as rootlyClient from "./client";

export function createRootlyTools() {
  return {
    search_incidents: tool({
      description:
        "Search Rootly incidents by service name, status, and time window. Returns active and recently resolved incidents for triage context.",
      inputSchema: z.object({
        services: z
          .array(z.string())
          .optional()
          .describe("Service names to filter by"),
        statuses: z
          .array(z.string())
          .optional()
          .default(["started", "investigating", "mitigated", "resolved"])
          .describe("Incident statuses to include"),
        hoursAgo: z
          .number()
          .optional()
          .default(4)
          .describe("Look back this many hours"),
      }),
      execute: async ({ services, statuses, hoursAgo }) => {
        const startedAfter = new Date(
          Date.now() - hoursAgo * 60 * 60 * 1000,
        ).toISOString();
        const incidents = await rootlyClient.searchIncidents({
          services,
          statuses,
          startedAfter,
        });
        return {
          count: incidents.length,
          incidents: incidents.map((inc) => ({
            id: inc.id,
            title: inc.attributes.title,
            severity: inc.attributes.severity?.name ?? "Unknown",
            status: inc.attributes.status,
            commander: inc.attributes.commander?.name,
            slackChannel: inc.attributes.slack_channel_id,
            services:
              inc.attributes.services?.map((s) => s.name) ?? [],
            startedAt: inc.attributes.started_at,
            resolvedAt: inc.attributes.resolved_at,
          })),
        };
      },
    }),

    get_incident_details: tool({
      description:
        "Get full details of a specific Rootly incident including root cause, services, and duration.",
      inputSchema: z.object({
        incidentId: z.string().describe("Rootly incident ID"),
      }),
      execute: async ({ incidentId }) => {
        const inc = await rootlyClient.getIncident(incidentId);
        return {
          id: inc.id,
          title: inc.attributes.title,
          summary: inc.attributes.summary,
          severity: inc.attributes.severity?.name,
          status: inc.attributes.status,
          commander: inc.attributes.commander?.name,
          slackChannel: inc.attributes.slack_channel_id,
          services: inc.attributes.services?.map((s) => s.name),
          environments: inc.attributes.environments?.map((e) => e.name),
          startedAt: inc.attributes.started_at,
          resolvedAt: inc.attributes.resolved_at,
          mitigatedAt: inc.attributes.mitigated_at,
          url: inc.attributes.url,
        };
      },
    }),

    get_incident_timeline: tool({
      description:
        "Get the timeline of a Rootly incident showing status changes, messages, and action items.",
      inputSchema: z.object({
        incidentId: z.string().describe("Rootly incident ID"),
      }),
      execute: async ({ incidentId }) => {
        const events = await rootlyClient.getIncidentTimeline(incidentId);
        return {
          count: events.length,
          events: events.map((e) => ({
            kind: e.attributes.kind,
            time: e.attributes.created_at,
            content: e.attributes.content,
            user: e.attributes.user?.name,
          })),
        };
      },
    }),
  };
}
