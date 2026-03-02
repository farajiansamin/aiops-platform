import { NextRequest, NextResponse } from "next/server";
import { getApproval } from "@/lib/db/queries/approvals";
import { resolveCheckpoint } from "@/lib/workflows/human-loop";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const approval = await getApproval(id);
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(approval);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { decision, decidedBy } = await request.json();

  if (!decision || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json(
      { error: "Invalid decision. Must be 'approved' or 'rejected'." },
      { status: 400 },
    );
  }

  const approval = await getApproval(id);
  if (!approval) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: `Approval already ${approval.status}` },
      { status: 409 },
    );
  }

  await resolveCheckpoint(id, decision, decidedBy ?? "unknown");

  return NextResponse.json({ ok: true, status: decision });
}
