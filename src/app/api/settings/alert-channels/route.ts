import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const [row] = await db
    .insert(schema.alertChannels)
    .values({
      channelId: body.channelId,
      channelName: body.channelName,
      alertType: body.alertType || null,
    })
    .returning();
  return NextResponse.json(row);
}

export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const body = await request.json();
  const [row] = await db
    .update(schema.alertChannels)
    .set({
      channelId: body.channelId,
      channelName: body.channelName,
      alertType: body.alertType || null,
    })
    .where(eq(schema.alertChannels.id, id))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await db.delete(schema.alertChannels).where(eq(schema.alertChannels.id, id));
  return NextResponse.json({ ok: true });
}
