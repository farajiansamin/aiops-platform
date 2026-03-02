import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import type { NewFAQ } from "../schema";

export async function listFAQs(status?: string) {
  const query = db
    .select()
    .from(schema.faqs)
    .orderBy(desc(schema.faqs.updatedAt));
  if (status) {
    return query.where(eq(schema.faqs.status, status));
  }
  return query;
}

export async function getFAQ(id: string) {
  const rows = await db
    .select()
    .from(schema.faqs)
    .where(eq(schema.faqs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createFAQ(data: NewFAQ) {
  const [row] = await db.insert(schema.faqs).values(data).returning();
  return row;
}

export async function updateFAQ(id: string, data: Partial<NewFAQ>) {
  await db
    .update(schema.faqs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.faqs.id, id));
}

export async function deleteFAQ(id: string) {
  await db.delete(schema.faqs).where(eq(schema.faqs.id, id));
}
