import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [comm] = await db
    .select()
    .from(schema.communications)
    .where(eq(schema.communications.id, id))
    .limit(1);

  if (!comm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(comm);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const [comm] = await db
    .select()
    .from(schema.communications)
    .where(eq(schema.communications.id, id))
    .limit(1);

  if (!comm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.subject !== undefined) updates.subject = body.subject;
  if (body.body !== undefined) updates.body = body.body;
  if (body.status !== undefined) updates.status = body.status;
  if (body.recipientSegment !== undefined)
    updates.recipientSegment = body.recipientSegment;

  await db
    .update(schema.communications)
    .set(updates)
    .where(eq(schema.communications.id, id));

  return NextResponse.json({ ok: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { action, testEmail } = await request.json();

  const [comm] = await db
    .select()
    .from(schema.communications)
    .where(eq(schema.communications.id, id))
    .limit(1);

  if (!comm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (action === "test") {
    // In production, this would send via your email provider (SendGrid, SES, etc.)
    // For now, log the test send
    console.log(
      `[TEST SEND] To: ${testEmail}, Subject: ${comm.subject}, Body length: ${comm.body.length}`,
    );

    await db.insert(schema.auditLog).values({
      action: "communication_test_sent",
      actor: "dashboard_user",
      actorType: "human",
      resourceType: "communication",
      resourceId: id,
      details: { testEmail, subject: comm.subject },
    });

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${testEmail}`,
    });
  }

  if (action === "send") {
    // In production, this would:
    // 1. Fetch impacted users from the impacted_users table for this incident
    // 2. Filter by segment if specified
    // 3. Send via email provider (SendGrid, SES, etc.)
    // 4. Track delivery status

    await db
      .update(schema.communications)
      .set({
        status: "sent",
        sentAt: new Date(),
        sentBy: "dashboard_user",
        updatedAt: new Date(),
      })
      .where(eq(schema.communications.id, id));

    await db.insert(schema.auditLog).values({
      action: "communication_sent",
      actor: "dashboard_user",
      actorType: "human",
      resourceType: "communication",
      resourceId: id,
      details: {
        recipientCount: comm.recipientCount,
        recipientSegment: comm.recipientSegment,
        subject: comm.subject,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Communication sent to ${comm.recipientCount} recipients`,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
