/**
 * Demo Seed Script
 *
 * Seeds the issue_embeddings table with historical issues so that
 * the "Search Previous Related Issues" feature has data to match against.
 *
 * Also seeds impacted_users for the customer impact demo.
 *
 * Usage:
 *   1. Copy .env.local values or export them:
 *        export POSTGRES_URL="postgresql://..."
 *        export OPENAI_API_KEY="sk-..."   (or GOOGLE_GENERATIVE_AI_API_KEY)
 *
 *   2. Run:
 *        node scripts/seed-demo.mjs
 */

import pg from "pg";

const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL;
if (!POSTGRES_URL) {
  console.error("POSTGRES_URL is required. Export it before running this script.");
  process.exit(1);
}

const pool = new Pool({ connectionString: POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// ─── Embedding generation ────────────────────────────────────────────────────

async function generateEmbedding(text) {
  if (process.env.OPENAI_API_KEY) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI embedding error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.data[0].embedding;
  }

  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } }),
      }
    );
    if (!res.ok) throw new Error(`Google embedding error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.embedding.values;
  }

  throw new Error("Set OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY for embeddings.");
}

// ─── Historical issues to seed ───────────────────────────────────────────────

const HISTORICAL_ISSUES = [
  {
    description:
      "Symptoms: crashing, OOMKilled, pod restarts. The order-processing service keeps crashing every few minutes. Pods are restarting with OOMKilled errors. Started about an hour ago after the last deployment.",
    service: "order-processing",
    symptoms: ["crashing", "OOMKilled", "pod restarts"],
    resolvedVia:
      "Found the issue -- the new deployment bumped the image processing library which has a memory leak. Fixed by increasing memory limits to 512Mi and rolling back the library version: kubectl set resources deployment/order-processing -c order-processing --limits=memory=512Mi && kubectl rollout restart deployment/order-processing",
  },
  {
    description:
      "Symptoms: intermittent timeouts, 504 errors, DB connections maxing out. We're seeing intermittent timeouts on the checkout-service API. Customers are getting 504 errors during payment. DB connections seem to be maxing out.",
    service: "checkout-service",
    symptoms: ["intermittent timeouts", "504 errors", "DB connection exhaustion"],
    resolvedVia:
      "Root cause was DB connection pool exhaustion. The connection pool was set to 10 which is too low after we added the new batch processing job. Fixed with: kubectl set env deployment/checkout-service DB_POOL_MAX=25 && kubectl rollout restart deployment/checkout-service. Also opened a ticket to properly implement connection pooling with PgBouncer.",
  },
  {
    description:
      "Symptoms: Lambda timeouts, memory spikes, high failure rate. notification-service Lambda functions are timing out. Looks like memory is spiking. CloudWatch shows invocations failing at ~45% rate for the last 40 minutes.",
    service: "notification-service",
    symptoms: ["Lambda timeouts", "memory spikes", "high failure rate"],
    resolvedVia:
      "The Lambda memory was set to 128MB which isn't enough for the new notification templates with images. Bumped it to 512MB in the serverless config and redeployed. Also set a concurrency limit to prevent runaway invocations: aws lambda update-function-configuration --function-name notification-sender --memory-size 512",
  },
];

// ─── Impacted users for customer impact demo ─────────────────────────────────

const DEMO_IMPACTED_USERS = [
  { externalUserId: "usr_001", email: "alice@acmecorp.com", tier: "enterprise", impactType: "failed_payment", impactDetails: "12 errors" },
  { externalUserId: "usr_002", email: "bob@acmecorp.com", tier: "enterprise", impactType: "failed_payment", impactDetails: "8 errors" },
  { externalUserId: "usr_003", email: "carol@bigco.io", tier: "enterprise", impactType: "failed_payment", impactDetails: "5 errors" },
  { externalUserId: "usr_010", email: "dave@startup.com", tier: "business", impactType: "failed_payment", impactDetails: "3 errors" },
  { externalUserId: "usr_011", email: "eve@startup.com", tier: "business", impactType: "failed_payment", impactDetails: "7 errors" },
  { externalUserId: "usr_012", email: "frank@agency.co", tier: "business", impactType: "timeout", impactDetails: "4 errors" },
  { externalUserId: "usr_020", email: "grace@gmail.com", tier: "free", impactType: "failed_payment", impactDetails: "2 errors" },
  { externalUserId: "usr_021", email: "heidi@yahoo.com", tier: "free", impactType: "failed_payment", impactDetails: "1 errors" },
  { externalUserId: "usr_022", email: "ivan@outlook.com", tier: "free", impactType: "timeout", impactDetails: "3 errors" },
  { externalUserId: "usr_023", email: "judy@gmail.com", tier: "free", impactType: "failed_payment", impactDetails: "1 errors" },
  { externalUserId: "usr_024", email: "karl@proton.me", tier: "free", impactType: "timeout", impactDetails: "2 errors" },
  { externalUserId: "usr_025", email: "laura@gmail.com", tier: "free", impactType: "failed_payment", impactDetails: "1 errors" },
];

// ─── Seed functions ──────────────────────────────────────────────────────────

async function seedIssueEmbeddings() {
  console.log("\n=== Seeding issue_embeddings ===\n");

  for (const issue of HISTORICAL_ISSUES) {
    console.log(`  Generating embedding for: ${issue.service}...`);
    const embedding = await generateEmbedding(issue.description);

    await pool.query(
      `INSERT INTO issue_embeddings (id, description, service, symptoms, embedding, resolved_via, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW() - interval '2 days')
       ON CONFLICT DO NOTHING`,
      [
        issue.description,
        issue.service,
        JSON.stringify(issue.symptoms),
        JSON.stringify(embedding),
        issue.resolvedVia,
      ]
    );
    console.log(`  ✓ Inserted: ${issue.service}`);
  }
}

async function seedImpactedUsers() {
  console.log("\n=== Seeding demo incident + impacted users ===\n");

  // Check if the demo incident already exists
  const existing = await pool.query(
    "SELECT id FROM incidents WHERE rootly_id = $1",
    ["demo-inc-001"]
  );

  let incidentId;
  if (existing.rows.length > 0) {
    incidentId = existing.rows[0].id;
    console.log(`  Demo incident already exists: ${incidentId}`);
  } else {
    const res = await pool.query(
      `INSERT INTO incidents (id, rootly_id, title, summary, severity, status, commander, services, started_at, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        "demo-inc-001",
        "Payment Processing Outage - All Transactions Failing",
        "Complete payment processing failure. Stripe webhook handler crashing due to OOM. All customer payment attempts returning 500 errors.",
        "SEV1",
        "active",
        "Samin Farajian",
        JSON.stringify(["payment-service"]),
        new Date("2026-03-02T07:00:00Z"),
      ]
    );
    incidentId = res.rows[0].id;
    console.log(`  ✓ Created demo incident: ${incidentId}`);
  }

  // Seed impacted users
  for (const user of DEMO_IMPACTED_USERS) {
    await pool.query(
      `INSERT INTO impacted_users (id, incident_id, external_user_id, email, tier, impact_type, impact_details, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT DO NOTHING`,
      [incidentId, user.externalUserId, user.email, user.tier, user.impactType, user.impactDetails]
    );
  }

  // Update incident's impacted user count
  await pool.query(
    "UPDATE incidents SET impacted_user_count = $1, updated_at = NOW() WHERE id = $2",
    [DEMO_IMPACTED_USERS.length, incidentId]
  );

  console.log(`  ✓ Inserted ${DEMO_IMPACTED_USERS.length} impacted users for incident ${incidentId}`);
  console.log(`    Breakdown: 3 enterprise, 3 business, 6 free`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("AIOps Demo Seed Script");
  console.log("======================");

  try {
    await seedIssueEmbeddings();
    await seedImpactedUsers();

    console.log("\n=== Done! ===");
    console.log("\nSeeded data:");
    console.log("  - 3 issue embeddings (order-processing, checkout-service, notification-service)");
    console.log("  - 1 demo incident (demo-inc-001)");
    console.log("  - 12 impacted users (3 enterprise, 3 business, 6 free)");
    console.log("\nYou can now run the demo scenarios.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
