import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import type { NewApproval } from "../schema";

export async function listPendingApprovals() {
  return db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.status, "pending"))
    .orderBy(desc(schema.approvals.createdAt));
}

export async function listApprovals(limit = 50) {
  return db
    .select()
    .from(schema.approvals)
    .orderBy(desc(schema.approvals.createdAt))
    .limit(limit);
}

export async function getApproval(id: string) {
  const rows = await db
    .select()
    .from(schema.approvals)
    .where(eq(schema.approvals.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createApproval(data: NewApproval) {
  const [row] = await db.insert(schema.approvals).values(data).returning();
  return row;
}

export async function resolveApproval(
  id: string,
  decision: "approved" | "rejected",
  decidedBy: string,
) {
  await db
    .update(schema.approvals)
    .set({
      status: decision,
      decidedBy,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.approvals.id, id));
}
