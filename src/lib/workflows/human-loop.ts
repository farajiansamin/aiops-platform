import { createApproval } from "@/lib/db/queries/approvals";
import { postMessage } from "@/lib/providers/slack/client";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { NewApproval } from "@/lib/db/schema";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function createHumanCheckpoint(params: {
  workflowId: string;
  type: "execution_authority" | "knowledge_approval" | "data_validation" | "tone_calibration";
  summary: string;
  payload: Record<string, unknown>;
  slackChannel?: string;
  expiresInMinutes?: number;
}): Promise<string> {
  const approval = await createApproval({
    workflowId: params.workflowId,
    type: params.type,
    summary: params.summary,
    payload: params.payload,
    expiresAt: params.expiresInMinutes
      ? new Date(Date.now() + params.expiresInMinutes * 60 * 1000)
      : undefined,
  } as NewApproval);

  const detailUrl = `${APP_URL}/approvals/${approval.id}`;

  await db
    .update(schema.approvals)
    .set({ detailUrl })
    .where(eq(schema.approvals.id, approval.id));

  if (params.slackChannel) {
    const typeLabels: Record<string, string> = {
      execution_authority: "Execution Approval",
      knowledge_approval: "Knowledge Review",
      data_validation: "Data Validation",
      tone_calibration: "Tone Review",
    };

    await postMessage(params.slackChannel, `AI requests review: ${params.summary}`, {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${typeLabels[params.type] ?? "Review Required"}*\n${params.summary}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Review in Dashboard", emoji: true },
              url: detailUrl,
              action_id: "open_approval_dashboard",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Approve", emoji: true },
              style: "primary",
              action_id: "approve_inline",
              value: approval.id,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Reject", emoji: true },
              style: "danger",
              action_id: "reject_inline",
              value: approval.id,
            },
          ],
        },
      ],
    });
  }

  await logAuditEntry({
    action: "human_checkpoint_created",
    actor: "ai_agent",
    actorType: "ai",
    resourceType: "approval",
    resourceId: approval.id,
    details: {
      type: params.type,
      summary: params.summary,
      workflowId: params.workflowId,
    },
  });

  return approval.id;
}

export async function resolveCheckpoint(
  approvalId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
): Promise<void> {
  await db
    .update(schema.approvals)
    .set({
      status: decision,
      decidedBy,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.approvals.id, approvalId));

  await logAuditEntry({
    action: `human_checkpoint_${decision}`,
    actor: decidedBy,
    actorType: "human",
    resourceType: "approval",
    resourceId: approvalId,
    details: { decision },
  });
}

async function logAuditEntry(entry: {
  action: string;
  actor: string;
  actorType: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await db.insert(schema.auditLog).values(entry);
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
