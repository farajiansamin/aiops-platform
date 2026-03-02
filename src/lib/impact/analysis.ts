import pg from "pg";
import { db, schema } from "@/lib/db";

const { Pool } = pg;

/**
 * Impact Analysis module.
 *
 * Connects to a READ-ONLY application database (separate from the AIOps platform DB)
 * to query for impacted users during an incident timeframe.
 *
 * The app DB connection is optional. When APP_DATABASE_URL is not set,
 * the module returns empty results and logs a warning.
 */

let appDbPool: pg.Pool | null = null;

function getAppDbPool(): pg.Pool | null {
  if (appDbPool) return appDbPool;
  const url = process.env.APP_DATABASE_URL;
  if (!url) {
    console.warn(
      "APP_DATABASE_URL not configured -- impact analysis will return empty results.",
    );
    return null;
  }
  appDbPool = new Pool({
    connectionString: url,
    max: 3,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl:
      process.env.APP_DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false },
  });
  return appDbPool;
}

export interface ImpactedUserRecord {
  userId: string;
  email?: string;
  tier?: string;
  impactType: string;
  details?: string;
}

export interface ImpactAnalysisResult {
  totalImpacted: number;
  users: ImpactedUserRecord[];
  segmentation: {
    tier: string;
    count: number;
  }[];
  queryUsed: string;
}

/**
 * Queries the application database for users impacted by an incident.
 *
 * The query template is configurable via APP_IMPACT_QUERY env var.
 * It receives $1 = start time, $2 = end time, $3 = service name(s).
 *
 * Default query assumes a table `failed_requests` with columns:
 * user_id, email, user_tier, error_type, service_name, created_at
 */
export async function analyzeImpact(params: {
  incidentId: string;
  startedAt: Date;
  resolvedAt?: Date;
  services: string[];
}): Promise<ImpactAnalysisResult> {
  const pool = getAppDbPool();

  if (!pool) {
    return {
      totalImpacted: 0,
      users: [],
      segmentation: [],
      queryUsed: "N/A (APP_DATABASE_URL not configured)",
    };
  }

  const endTime = params.resolvedAt ?? new Date();
  const serviceList = params.services.length > 0 ? params.services : ["*"];

  const query =
    process.env.APP_IMPACT_QUERY ??
    `SELECT DISTINCT
       user_id,
       email,
       user_tier AS tier,
       error_type AS impact_type,
       COUNT(*) AS error_count
     FROM failed_requests
     WHERE created_at >= $1
       AND created_at <= $2
       AND ($3::text = '*' OR service_name = ANY($3::text[]))
     GROUP BY user_id, email, user_tier, error_type
     ORDER BY error_count DESC
     LIMIT 5000`;

  try {
    const result = await pool.query(query, [
      params.startedAt.toISOString(),
      endTime.toISOString(),
      serviceList.join(","),
    ]);

    const users: ImpactedUserRecord[] = result.rows.map((row) => ({
      userId: String(row.user_id),
      email: row.email ?? undefined,
      tier: row.tier ?? "unknown",
      impactType: row.impact_type ?? "unknown",
      details: row.error_count ? `${row.error_count} errors` : undefined,
    }));

    // Calculate segmentation
    const tierCounts = new Map<string, number>();
    for (const u of users) {
      const tier = u.tier ?? "unknown";
      tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1);
    }
    const segmentation = Array.from(tierCounts.entries())
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);

    // Persist to AIOps DB for the Web UI
    await persistImpactedUsers(params.incidentId, users);

    return {
      totalImpacted: users.length,
      users,
      segmentation,
      queryUsed: query.replace(/\s+/g, " ").trim(),
    };
  } catch (err) {
    console.error("Impact analysis query failed:", err);
    return {
      totalImpacted: 0,
      users: [],
      segmentation: [],
      queryUsed: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function persistImpactedUsers(
  incidentId: string,
  users: ImpactedUserRecord[],
) {
  if (users.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize).map((u) => ({
      incidentId,
      externalUserId: u.userId,
      email: u.email,
      tier: u.tier,
      impactType: u.impactType,
      impactDetails: u.details,
    }));
    try {
      await db.insert(schema.impactedUsers).values(batch);
    } catch (err) {
      console.error("Failed to persist impacted users batch:", err);
    }
  }

  // Update the incident's impactedUserCount
  const { eq } = await import("drizzle-orm");
  await db
    .update(schema.incidents)
    .set({ impactedUserCount: users.length, updatedAt: new Date() })
    .where(eq(schema.incidents.id, incidentId));
}
