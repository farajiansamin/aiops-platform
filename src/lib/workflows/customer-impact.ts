import { generateText, type LanguageModel } from "ai";
import { getIncident } from "@/lib/providers/rootly/client";
import { analyzeImpact } from "@/lib/impact/analysis";
import { postMessage } from "@/lib/providers/slack/client";
import { db, schema } from "@/lib/db";
import { createHumanCheckpoint } from "./human-loop";

export async function runCustomerImpactWorkflow(params: {
  incidentId: string;
  rootlyIncidentId: string;
  model: LanguageModel;
  slackChannel?: string;
}): Promise<{
  communicationId: string;
  approvalId: string;
  impactResult: {
    totalImpacted: number;
    segmentation: Array<{ tier: string; count: number }>;
  };
}> {
  // Step 1: Get incident context from Rootly
  const incident = await getIncident(params.rootlyIncidentId);

  // Step 2: Run impact analysis against the application database
  const impactResult = await analyzeImpact({
    incidentId: params.incidentId,
    startedAt: new Date(incident.attributes.started_at),
    resolvedAt: incident.attributes.resolved_at
      ? new Date(incident.attributes.resolved_at)
      : undefined,
    services:
      incident.attributes.services?.map((s) => s.name) ?? [],
  });

  // Step 3: Post Slack summary ("Glance and Click")
  if (params.slackChannel) {
    const segText =
      impactResult.segmentation.length > 0
        ? impactResult.segmentation
            .map((s) => `${s.tier}: ${s.count}`)
            .join(" | ")
        : "No segmentation data";

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await postMessage(
      params.slackChannel,
      `Incident impact estimated at ${impactResult.totalImpacted} users.`,
      {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Incident Impact Analysis*\nEstimated *${impactResult.totalImpacted} users* impacted.\n\nBreakdown: ${segText}`,
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "View Impact Details",
                  emoji: true,
                },
                url: `${appUrl}/incidents/${params.incidentId}`,
                action_id: "open_impact_dashboard",
              },
            ],
          },
        ],
      },
    );
  }

  // Step 4: Draft the communication email
  const { text: emailDraft } = await generateText({
    model: params.model,
    prompt: `Draft a customer-facing incident notification email based on this incident:

Title: ${incident.attributes.title}
Severity: ${incident.attributes.severity?.name ?? "Unknown"}
Summary: ${incident.attributes.summary ?? "N/A"}
Started: ${incident.attributes.started_at}
Resolved: ${incident.attributes.resolved_at ?? "Ongoing"}
Affected Services: ${incident.attributes.services?.map((s) => s.name).join(", ") ?? "Unknown"}
Total Impacted Users: ${impactResult.totalImpacted}
User Segmentation: ${impactResult.segmentation.map((s) => `${s.tier}: ${s.count}`).join(", ") || "N/A"}

Write a professional, empathetic email that:
1. Acknowledges the issue and apologizes
2. Explains what happened in plain language (no jargon)
3. Describes what was done to resolve it
4. Outlines steps to prevent recurrence
5. Provides a contact for follow-up questions

Do NOT admit legal liability or reference SLAs. Keep the tone warm but professional.
Format as plain text with a Subject line at the top.`,
  });

  const subjectMatch = emailDraft.match(/^Subject:\s*(.+)$/m);
  const subject =
    subjectMatch?.[1] ?? `Service Update: ${incident.attributes.title}`;
  const body = emailDraft.replace(/^Subject:\s*.+\n/m, "").trim();

  // Step 5: Save the communication draft
  const [communication] = await db
    .insert(schema.communications)
    .values({
      incidentId: params.incidentId,
      subject,
      body,
      recipientCount: impactResult.totalImpacted,
      recipientSegment: impactResult.segmentation
        .map((s) => `${s.tier}: ${s.count}`)
        .join(", "),
      status: "draft",
    })
    .returning();

  // Step 6: Create human checkpoint for tone review
  const approvalId = await createHumanCheckpoint({
    workflowId: `customer-impact-${params.incidentId}`,
    type: "tone_calibration",
    summary: `Review email draft for incident "${incident.attributes.title}" targeting ${impactResult.totalImpacted} users (${impactResult.segmentation.map((s) => s.tier).join(", ")}).`,
    payload: {
      communicationId: communication.id,
      subject,
      bodyPreview: body.slice(0, 200),
      recipientCount: impactResult.totalImpacted,
      segmentation: impactResult.segmentation,
    },
    slackChannel: params.slackChannel,
  });

  return {
    communicationId: communication.id,
    approvalId,
    impactResult: {
      totalImpacted: impactResult.totalImpacted,
      segmentation: impactResult.segmentation,
    },
  };
}
