import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const [row] = await db
    .insert(schema.serviceRepos)
    .values({
      serviceName: body.serviceName,
      repoFullName: body.repoFullName,
      pathsFilter: body.pathsFilter || null,
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
    .update(schema.serviceRepos)
    .set({
      serviceName: body.serviceName,
      repoFullName: body.repoFullName,
      pathsFilter: body.pathsFilter || null,
    })
    .where(eq(schema.serviceRepos.id, id))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  await db.delete(schema.serviceRepos).where(eq(schema.serviceRepos.id, id));
  return NextResponse.json({ ok: true });
}
