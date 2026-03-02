import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [pm] = await db
    .select()
    .from(schema.postmortems)
    .where(eq(schema.postmortems.id, id))
    .limit(1);

  if (!pm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(pm);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const [pm] = await db
    .select()
    .from(schema.postmortems)
    .where(eq(schema.postmortems.id, id))
    .limit(1);

  if (!pm) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "published") {
      updates.publishedAt = new Date();
      updates.publishedBy = "dashboard_user";
    }
  }

  await db
    .update(schema.postmortems)
    .set(updates)
    .where(eq(schema.postmortems.id, id));

  // Log the action
  await db.insert(schema.auditLog).values({
    action: body.status === "published" ? "postmortem_published" : "postmortem_updated",
    actor: "dashboard_user",
    actorType: "human",
    resourceType: "postmortem",
    resourceId: id,
    details: { updatedFields: Object.keys(body) },
  });

  return NextResponse.json({ ok: true });
}
