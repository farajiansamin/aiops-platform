import { NextRequest, NextResponse, after } from "next/server";
import { upsertIncident } from "@/lib/db/queries/incidents";
import { runPostmortemDrafter } from "@/lib/workflows/postmortem-drafter";
import { runCustomerImpactWorkflow } from "@/lib/workflows/customer-impact";
import { getModel } from "@/lib/agent";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  const event = payload.data ?? payload;
  const eventType = payload.type ?? payload.event_type ?? "unknown";

  after(async () => {
    try {
      const incident = await upsertIncident({
        rootlyId: String(event.id ?? event.incident_id),
        title: event.attributes?.title ?? event.title ?? "Untitled Incident",
        summary: event.attributes?.summary ?? event.summary,
        severity: event.attributes?.severity?.name ?? event.severity,
        status: event.attributes?.status ?? event.status ?? "active",
        commander: event.attributes?.commander?.name ?? event.commander,
        slackChannelId: event.attributes?.slack_channel_id ?? event.slack_channel_id,
        services: event.attributes?.services?.map((s: { name: string }) => s.name) ?? [],
        startedAt: event.attributes?.started_at ? new Date(event.attributes.started_at) : undefined,
        mitigatedAt: event.attributes?.mitigated_at ? new Date(event.attributes.mitigated_at) : undefined,
        resolvedAt: event.attributes?.resolved_at ? new Date(event.attributes.resolved_at) : undefined,
      });

      if (eventType === "incident.resolved" || event.attributes?.status === "resolved") {
        const model = getModel();
        await runPostmortemDrafter({
          incidentId: incident.id,
          rootlyIncidentId: String(event.id ?? event.incident_id),
          model,
          slackChannel: event.attributes?.slack_channel_id,
        });
      }

      const severity = event.attributes?.severity?.name ?? event.severity ?? "";
      if (
        (eventType === "incident.created" || eventType === "incident.updated") &&
        ["P0", "P1", "SEV0", "SEV1"].includes(severity)
      ) {
        const model = getModel();
        await runCustomerImpactWorkflow({
          incidentId: incident.id,
          rootlyIncidentId: String(event.id ?? event.incident_id),
          model,
          slackChannel: event.attributes?.slack_channel_id,
        });
      }
    } catch (err) {
      console.error("Rootly webhook error:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
