import { generateText, type LanguageModel } from "ai";
import { getIncident, getIncidentTimeline } from "@/lib/providers/rootly/client";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { createHumanCheckpoint } from "./human-loop";

export async function runPostmortemDrafter(params: {
  incidentId: string;
  rootlyIncidentId: string;
  model: LanguageModel;
  slackChannel?: string;
}): Promise<{
  postmortemId: string;
  approvalId: string;
}> {
  // Gather incident data, timeline, and impact data in parallel
  const [incident, timeline, impactData, commData] = await Promise.all([
    getIncident(params.rootlyIncidentId),
    getIncidentTimeline(params.rootlyIncidentId),
    fetchImpactSummary(params.incidentId),
    fetchCommunicationsSummary(params.incidentId),
  ]);

  const timelineText = timeline
    .map(
      (e) =>
        `[${e.attributes.created_at}] (${e.attributes.kind}) ${e.attributes.content}${e.attributes.user ? ` - ${e.attributes.user.name}` : ""}`,
    )
    .join("\n");

  const impactSection = impactData.totalUsers > 0
    ? `\n## Customer Impact Data
- Total Impacted Users: ${impactData.totalUsers}
- Segmentation: ${impactData.segmentation.map((s) => `${s.tier}: ${s.count}`).join(", ") || "N/A"}
- Impact Types: ${impactData.impactTypes.join(", ") || "N/A"}`
    : "\n## Customer Impact Data\nNo impacted user data recorded.";

  const commsSection = commData.length > 0
    ? `\n## Customer Communications
${commData.map((c) => `- "${c.subject}" (Status: ${c.status}, Recipients: ${c.recipientCount})`).join("\n")}`
    : "";

  // Generate the post-mortem draft
  const { text: pirContent } = await generateText({
    model: params.model,
    prompt: `Draft a Post-Incident Review (PIR) document based on this incident data:

## Incident Details
- Title: ${incident.attributes.title}
- Severity: ${incident.attributes.severity?.name ?? "Unknown"}
- Status: ${incident.attributes.status}
- Started: ${incident.attributes.started_at}
- Mitigated: ${incident.attributes.mitigated_at ?? "N/A"}
- Resolved: ${incident.attributes.resolved_at ?? "N/A"}
- Commander: ${incident.attributes.commander?.name ?? "Unassigned"}
- Affected Services: ${incident.attributes.services?.map((s) => s.name).join(", ") ?? "Unknown"}
- Summary: ${incident.attributes.summary ?? "N/A"}

## Incident Timeline
${timelineText || "No timeline events available."}
${impactSection}${commsSection}

Write the PIR with these sections:
1. **Incident Summary** - Date, duration, severity, one-paragraph summary
2. **Timeline** - Chronological key events from detection to resolution
3. **Root Cause Analysis** - What caused it, what triggered it, contributing factors
4. **Impact** - Affected users/services, user count and segmentation, revenue/SLA impact if inferrable
5. **What Went Well** - Effective response actions
6. **What Could Be Improved** - Detection gaps, response delays
7. **Action Items** - Specific tasks to prevent recurrence (suggest owners where possible)

Be factual and blameless. Focus on systems, not individuals.
Format the document in Markdown.`,
  });

  // Save the post-mortem draft
  const [postmortem] = await db
    .insert(schema.postmortems)
    .values({
      incidentId: params.incidentId,
      title: `PIR: ${incident.attributes.title}`,
      content: pirContent,
      status: "draft",
    })
    .returning();

  // Create human checkpoint
  const approvalId = await createHumanCheckpoint({
    workflowId: `postmortem-${params.incidentId}`,
    type: "knowledge_approval",
    summary: `Review post-mortem draft for "${incident.attributes.title}". The document needs incident commander approval before publishing to Confluence.`,
    payload: {
      postmortemId: postmortem.id,
      incidentTitle: incident.attributes.title,
      contentPreview: pirContent.slice(0, 300),
    },
    slackChannel: params.slackChannel,
  });

  return { postmortemId: postmortem.id, approvalId };
}

async function fetchImpactSummary(incidentId: string): Promise<{
  totalUsers: number;
  segmentation: Array<{ tier: string; count: number }>;
  impactTypes: string[];
}> {
  try {
    const users = await db
      .select()
      .from(schema.impactedUsers)
      .where(eq(schema.impactedUsers.incidentId, incidentId));

    if (users.length === 0) {
      return { totalUsers: 0, segmentation: [], impactTypes: [] };
    }

    const tierCounts = new Map<string, number>();
    const impactTypeSet = new Set<string>();

    for (const u of users) {
      const tier = u.tier ?? "unknown";
      tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
      if (u.impactType) impactTypeSet.add(u.impactType);
    }

    return {
      totalUsers: users.length,
      segmentation: Array.from(tierCounts.entries())
        .map(([tier, count]) => ({ tier, count }))
        .sort((a, b) => b.count - a.count),
      impactTypes: Array.from(impactTypeSet),
    };
  } catch {
    return { totalUsers: 0, segmentation: [], impactTypes: [] };
  }
}

async function fetchCommunicationsSummary(incidentId: string): Promise<
  Array<{ subject: string; status: string; recipientCount: number }>
> {
  try {
    const comms = await db
      .select()
      .from(schema.communications)
      .where(eq(schema.communications.incidentId, incidentId));

    return comms.map((c) => ({
      subject: c.subject,
      status: c.status,
      recipientCount: c.recipientCount ?? 0,
    }));
  } catch {
    return [];
  }
}
