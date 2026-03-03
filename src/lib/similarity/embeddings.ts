import { embed } from "ai";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { ExtractedEntities } from "@/lib/workflows/types";

const SIMILARITY_THRESHOLD = 0.65;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Builds a description that emphasizes the error *pattern* rather than
 * the specific service name.  This way "OOM kill on image-resizer"
 * matches "OOM kill on payment-api" because the underlying problem is
 * the same.  The service name is stored in a separate DB column for
 * reference, but kept minimal in the embedding text so it doesn't
 * dominate the vector.
 */
function buildIssueDescription(entities: ExtractedEntities): string {
  const parts: string[] = [];
  if (entities.symptoms.length > 0) {
    parts.push(`Symptoms: ${entities.symptoms.join(", ")}`);
  }
  if (entities.isTerraform) {
    parts.push(
      `Terraform ${entities.terraformResource ? `resource: ${entities.terraformResource}` : "related issue"}`,
    );
  }
  // Use the raw message as the primary embedding content — it
  // captures the natural-language error description the user typed.
  parts.push(entities.rawMessage.slice(0, 400));
  return parts.join(". ");
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getEmbeddingModel(): Promise<Parameters<typeof embed>[0]["model"]> {
  if (env.OPENAI_API_KEY) {
    const { createOpenAI } = await import("@ai-sdk/openai");
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    return openai.embedding("text-embedding-3-small") as any;
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    const google = createGoogleGenerativeAI({
      apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
    });
    return google.textEmbeddingModel("gemini-embedding-001") as any;
  }
  throw new Error(
    "No embedding model available. Set OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY for embedding support.",
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SimilarIssue {
  id: string;
  description: string;
  service: string;
  symptoms: string[];
  channel: string | null;
  threadTs: string | null;
  resolvedVia: string | null;
  similarity: number;
  createdAt: Date;
}

/**
 * Generates an embedding for an issue and finds semantically similar past issues.
 *
 * Unlike fingerprint matching (which requires exact service+symptoms),
 * this catches variations like "payment service is down" vs
 * "payment-api returning 500 errors" because the embedding
 * captures semantic meaning rather than exact text.
 */
export async function findSimilarIssues(
  entities: ExtractedEntities,
): Promise<SimilarIssue[]> {
  const description = buildIssueDescription(entities);

  let currentEmbedding: number[];
  try {
    const embeddingModel = await getEmbeddingModel();
    const { embedding: embeddingResult } = await embed({
      model: embeddingModel,
      value: description,
    });
    currentEmbedding = embeddingResult;
  } catch (err) {
    console.error("Failed to generate embedding:", err);
    return [];
  }

  // Load stored embeddings and compute similarity in JS.
  // For production scale, use pgvector extension instead.
  const storedIssues = await db
    .select()
    .from(schema.issueEmbeddings)
    .limit(500);

  // Collect all matches, then deduplicate
  const allMatches: Array<SimilarIssue & { stored: typeof storedIssues[0] }> = [];

  for (const stored of storedIssues) {
    // Skip self-match (same thread as the current request)
    if (stored.threadTs && stored.threadTs === entities.threadTs) continue;

    // Skip issues from the same channel posted today (likely the user's
    // own test messages from the current session, not historical data)
    if (stored.channel && stored.channel === entities.channel) {
      const ageMs = Date.now() - stored.createdAt.getTime();
      if (ageMs < 24 * 60 * 60 * 1000) continue;
    }

    const similarity = cosineSimilarity(
      currentEmbedding,
      stored.embedding as number[],
    );
    if (similarity >= SIMILARITY_THRESHOLD) {
      allMatches.push({
        id: stored.id,
        description: stored.description,
        service: stored.service,
        symptoms: (stored.symptoms as string[]) ?? [],
        channel: stored.channel,
        threadTs: stored.threadTs,
        resolvedVia: stored.resolvedVia,
        similarity,
        createdAt: stored.createdAt,
        stored,
      });
    }
  }

  // Deduplicate: keep only the best match per service.
  // This prevents showing the same checkout-service issue twice
  // (once from seeded data, once from a Slack message).
  const bestByService = new Map<string, SimilarIssue>();
  for (const match of allMatches) {
    const existing = bestByService.get(match.service);
    if (!existing || match.similarity > existing.similarity) {
      const { stored: _stored, ...issue } = match;
      // Prefer the entry that has a resolvedVia (from seed data)
      if (existing && !issue.resolvedVia && existing.resolvedVia && Math.abs(match.similarity - existing.similarity) < 0.05) {
        continue;
      }
      bestByService.set(match.service, issue);
    }
  }

  return [...bestByService.values()].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Stores an issue with its embedding for future similarity searches.
 */
export async function storeIssueEmbedding(
  entities: ExtractedEntities,
  resolvedVia?: string,
): Promise<void> {
  const description = buildIssueDescription(entities);

  let embeddingVector: number[];
  try {
    const embeddingModel = await getEmbeddingModel();
    const { embedding: embeddingResult } = await embed({
      model: embeddingModel,
      value: description,
    });
    embeddingVector = embeddingResult;
  } catch (err) {
    console.error("Failed to generate embedding for storage:", err);
    return;
  }

  await db.insert(schema.issueEmbeddings).values({
    description,
    service: entities.service,
    symptoms: entities.symptoms,
    embedding: embeddingVector,
    channel: entities.channel,
    threadTs: entities.threadTs,
    resolvedVia,
  });
}
