import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApprovalActions } from "@/components/dashboard/approval-actions";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.id, id))
    .limit(1);

  if (!approval) notFound();

  // If this approval links to a specific resource, offer a shortcut
  const payload = approval.payload as Record<string, unknown> | null;
  const postmortemId = payload?.postmortemId as string | undefined;
  const communicationId = payload?.communicationId as string | undefined;
  const faqId = payload?.faqId as string | undefined;

  const statusColor =
    approval.status === "approved"
      ? "text-green-600 bg-green-500/10"
      : approval.status === "rejected"
        ? "text-red-600 bg-red-500/10"
        : approval.status === "expired"
          ? "text-muted-foreground bg-muted"
          : "text-amber-600 bg-amber-500/10";

  const typeLabels: Record<string, string> = {
    execution_authority: "Execution Approval",
    knowledge_approval: "Knowledge Review",
    data_validation: "Data Validation",
    tone_calibration: "Tone Review",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{typeLabels[approval.type] ?? "Review Required"}</CardTitle>
            <Badge variant="outline" className={statusColor}>
              {approval.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{approval.summary}</p>

          {payload && (
            <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
              {Object.entries(payload).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-muted-foreground font-medium min-w-[140px]">
                    {key}:
                  </span>
                  <span className="break-all">
                    {typeof value === "string" ? value : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Navigation to the related resource */}
          <div className="flex gap-2 flex-wrap">
            {postmortemId && (
              <a
                href={`/postmortems/${postmortemId}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View Post-Mortem Draft
              </a>
            )}
            {communicationId && (
              <a
                href="/communications"
                className="text-sm text-blue-600 hover:underline"
              >
                View Communication Draft
              </a>
            )}
            {faqId && (
              <a
                href={`/faq/${faqId}`}
                className="text-sm text-blue-600 hover:underline"
              >
                View FAQ Draft
              </a>
            )}
          </div>

          {approval.status === "pending" && (
            <ApprovalActions approvalId={approval.id} />
          )}

          {approval.decidedBy && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              {approval.status === "approved" ? "Approved" : "Rejected"} by{" "}
              {approval.decidedBy}
              {approval.decidedAt &&
                ` on ${new Date(approval.decidedAt).toLocaleString()}`}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Created {new Date(approval.createdAt).toLocaleString()}
            {approval.expiresAt &&
              ` | Expires ${new Date(approval.expiresAt).toLocaleString()}`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
