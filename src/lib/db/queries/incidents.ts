import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import type { NewIncident } from "../schema";

export async function listIncidents(limit = 50) {
  return db
    .select()
    .from(schema.incidents)
    .orderBy(desc(schema.incidents.createdAt))
    .limit(limit);
}

export async function getIncident(id: string) {
  const rows = await db
    .select()
    .from(schema.incidents)
    .where(eq(schema.incidents.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getIncidentByRootlyId(rootlyId: string) {
  const rows = await db
    .select()
    .from(schema.incidents)
    .where(eq(schema.incidents.rootlyId, rootlyId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertIncident(data: NewIncident) {
  if (data.rootlyId) {
    const existing = await getIncidentByRootlyId(data.rootlyId);
    if (existing) {
      await db
        .update(schema.incidents)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(schema.incidents.id, existing.id));
      return { ...existing, ...data };
    }
  }
  const [row] = await db.insert(schema.incidents).values(data).returning();
  return row;
}

export async function updateIncident(
  id: string,
  data: Partial<NewIncident>,
) {
  await db
    .update(schema.incidents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.incidents.id, id));
}
