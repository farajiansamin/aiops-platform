import { generateObject, type LanguageModel } from "ai";
import { z } from "zod/v4";
import type { ExtractedEntities, TriageContext } from "./types";
import { correlateAlerts } from "./alert-correlation";
import { createHumanCheckpoint } from "./human-loop";
import { searchIncidents } from "@/lib/providers/rootly/client";
import { listRecentPRs } from "@/lib/providers/github/client";
import {
  fetchChannelHistory,
  fetchThreadReplies,
  searchMessages,
  postMessage,
} from "@/lib/providers/slack/client";
import { searchPages, getPage } from "@/lib/providers/confluence/client";
import { buildTriageResponse } from "@/lib/providers/slack/blocks";
import { storeIssueEmbedding } from "@/lib/similarity/embeddings";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";

const entityExtractionSchema = z.object({
  service: z.string(),
  timeframe: z.string(),
  minutesAgo: z.number(),
  symptoms: z.array(z.string()),
  isTerraform: z.boolean(),
  terraformResource: z.string().nullable(),
});

export async function extractEntities(
  messageText: string,
  model: LanguageModel,
): Promise<Omit<ExtractedEntities, "rawMessage" | "channel" | "threadTs" | "userId">> {
  const { object } = await generateObject({
    model,
    schema: entityExtractionSchema,
    prompt: `Extract structured information from this infrastructure help request:

"${messageText}"

Identify:
- service: The service, system, or component name mentioned
- timeframe: How the user described the time (e.g., "last 30 minutes", "since this morning")
- minutesAgo: Your best estimate in minutes of how long ago the issue started
- symptoms: List of observed symptoms (crashing, slow, intermittent, timeout, errors, etc.)
- isTerraform: Whether this involves Terraform
- terraformResource: If Terraform-related, the resource or module name`,
  });
  return object;
}

export async function runInfraTriage(
  messageText: string,
  channel: string,
  threadTs: string,
  userId: string,
  model: LanguageModel,
): Promise<TriageContext> {
  // Phase 1: Entity extraction
  const extracted = await extractEntities(messageText, model);
  const entities: ExtractedEntities = {
    ...extracted,
    rawMessage: messageText,
    channel,
    threadTs,
    userId,
  };

  // Phase 2: Parallel investigation (FAQ check, alerts, incidents, GitHub)
  const [incidentResults, alertHistory, repoMappings] =
    await Promise.allSettled([
      env.ROOTLY_API_TOKEN
        ? searchIncidents({
            services: [entities.service],
            statuses: ["started", "investigating", "mitigated", "resolved"],
            startedAfter: new Date(
              Date.now() - Math.max(entities.minutesAgo, 120) * 60 * 1000,
            ).toISOString(),
          })
        : Promise.resolve([]),

      env.SLACK_BOT_TOKEN
        ? fetchAlertChannelHistory(entities.minutesAgo)
        : Promise.resolve([]),

      getServiceRepos(entities.service),
    ]);

  const incidents =
    incidentResults.status === "fulfilled" ? incidentResults.value : [];
  const rawAlerts =
    alertHistory.status === "fulfilled" ? alertHistory.value : [];
  const repos =
    repoMappings.status === "fulfilled" ? repoMappings.value : [];

  // Second parallel batch: alert correlation, GitHub, historical threads, FAQ
  const [alertCorrelation, recentChanges, historicalThreads, faqResults] =
    await Promise.allSettled([
      rawAlerts.length > 0
        ? correlateAlerts(entities, rawAlerts, model)
        : Promise.resolve(null),

      env.GITHUB_TOKEN && repos.length > 0
        ? fetchRecentChanges(repos, entities.minutesAgo)
        : Promise.resolve([]),

      env.SLACK_BOT_TOKEN
        ? fetchHistoricalThreadsWithReplies(entities.service)
        : Promise.resolve([]),

      env.ATLASSIAN_API_TOKEN
        ? searchAndFetchFAQContent(entities.service)
        : Promise.resolve([]),
    ]);

  const faqMatchesRaw =
    faqResults.status === "fulfilled" ? faqResults.value : [];

  const context: TriageContext = {
    entities,
    alertCorrelation:
      alertCorrelation.status === "fulfilled"
        ? (alertCorrelation.value ?? undefined)
        : undefined,
    relatedIncidents: incidents.map((inc) => ({
      id: inc.id,
      title: inc.attributes.title,
      severity: inc.attributes.severity?.name ?? "Unknown",
      status: inc.attributes.status,
      commander: inc.attributes.commander?.name,
      slackChannel: inc.attributes.slack_channel_id,
      startedAt: inc.attributes.started_at,
      resolvedAt: inc.attributes.resolved_at,
      services: inc.attributes.services?.map((s) => s.name) ?? [],
    })),
    recentChanges:
      recentChanges.status === "fulfilled" ? recentChanges.value : [],
    faqMatches: faqMatchesRaw.map((f) => ({
      id: f.id,
      title: f.title,
      url: f.url,
    })),
    historicalThreads:
      historicalThreads.status === "fulfilled"
        ? historicalThreads.value
        : [],
  };

  // Extract fix content from the best FAQ match
  const bestMatch = faqMatchesRaw[0];
  const faqFixContent = bestMatch?.content;
  const faqTitle = bestMatch?.title;
  const faqUrl = bestMatch?.url;

  // Phase 3: Post interactive triage summary
  // FAQ is checked FIRST. If found, fix is shown inline.
  // If NOT found, the agent explicitly says "No similar FAQ entry found"
  // and offers a "Search Previous Related Issues" button.
  if (env.SLACK_BOT_TOKEN) {
    const blocks = buildTriageResponse({
      serviceName: entities.service,
      alertCount: context.alertCorrelation?.relatedAlertCount ?? 0,
      hasRecentChanges: context.recentChanges.length > 0,
      changeCount: context.recentChanges.length,
      hasFAQMatch: context.faqMatches.length > 0,
      faqFixContent,
      faqTitle,
      faqUrl,
      relatedIncidents: context.relatedIncidents.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        commander: i.commander,
        slackChannel: i.slackChannel,
        startedAt: i.startedAt,
        resolvedAt: i.resolvedAt,
      })),
      threadTs,
    });

    await postMessage(channel, `Triage summary for ${entities.service}`, {
      threadTs,
      blocks,
    });

    // If a FAQ fix was found, create an execution_authority checkpoint
    if (faqFixContent) {
      await createHumanCheckpoint({
        workflowId: `infra-triage-${threadTs}`,
        type: "execution_authority",
        summary: `Suggested fix for "${entities.service}": ${faqTitle ?? "FAQ match"}. Review the command before executing.`,
        payload: {
          service: entities.service,
          fixTitle: faqTitle,
          fixContent: faqFixContent.slice(0, 500),
          faqUrl,
          threadTs,
          channel,
        },
        slackChannel: channel,
        threadTs,
      });
    }
  }

  // Phase 4: Store this issue's embedding for future similarity searches.
  // This runs in the background — does NOT block the triage response.
  storeIssueEmbedding(entities).catch((err) =>
    console.error("Failed to store issue embedding:", err),
  );

  return context;
}

/**
 * Searches Slack for past threads about the same service, then fetches
 * the full reply chain for each thread so the agent can read how the
 * team actually resolved the issue.
 */
async function fetchHistoricalThreadsWithReplies(
  serviceName: string,
): Promise<
  Array<{
    text: string;
    ts: string;
    channel: string;
    replies?: Array<{ text: string; user: string }>;
  }>
> {
  const msgs = await searchMessages(
    `"${serviceName}" in:#infrastructure`,
    { count: 5 },
  );

  const results = await Promise.all(
    msgs.map(async (m) => {
      let replies: Array<{ text: string; user: string }> | undefined;
      try {
        if (m.channel && m.ts) {
          const threadMsgs = await fetchThreadReplies(m.channel, m.ts);
          if (threadMsgs.length > 1) {
            replies = threadMsgs.slice(1).map((r) => ({
              text: r.text,
              user: r.user,
            }));
          }
        }
      } catch {
        // Thread fetch can fail if channel is archived or bot lacks access
      }
      return {
        text: m.text,
        ts: m.ts,
        channel: m.channel,
        replies,
      };
    }),
  );

  return results;
}

async function fetchAlertChannelHistory(
  minutesAgo: number,
): Promise<Array<{ text: string; ts: string }>> {
  const alertChannels = await db.select().from(schema.alertChannels);

  const allAlerts: Array<{ text: string; ts: string }> = [];
  const oldest = String(
    Math.floor(Date.now() / 1000) - Math.max(minutesAgo, 60) * 60,
  );

  for (const ch of alertChannels) {
    try {
      const history = await fetchChannelHistory(ch.channelId, oldest, 200);
      allAlerts.push(
        ...history.messages.map((m) => ({ text: m.text, ts: m.ts })),
      );
    } catch (err) {
      console.error(`Failed to fetch alerts from ${ch.channelName}:`, err);
    }
  }

  return allAlerts.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
}

async function getServiceRepos(
  serviceName: string,
): Promise<Array<{ owner: string; repo: string }>> {
  const variants = [
    serviceName,
    serviceName.replace(/\s+/g, "-"),
    serviceName.replace(/-/g, " "),
  ];

  for (const variant of variants) {
    const rows = await db
      .select()
      .from(schema.serviceRepos)
      .where(eq(schema.serviceRepos.serviceName, variant));

    if (rows.length > 0) {
      return rows.map((r) => {
        const [owner, repo] = r.repoFullName.split("/");
        return { owner, repo };
      });
    }
  }

  return [];
}

async function searchAndFetchFAQContent(
  serviceName: string,
): Promise<
  Array<{ id: string; title: string; url: string; content?: string }>
> {
  // Try multiple CQL variants to handle "payment service" vs "payment-service"
  const nameVariants = new Set([
    serviceName,
    serviceName.replace(/\s+/g, "-"),
    serviceName.replace(/-/g, " "),
  ]);

  let searchResult = { results: [] as Array<{ id: string; title: string; _links: { webui: string } }> };
  for (const variant of nameVariants) {
    try {
      searchResult = await searchPages(
        `(title ~ "${variant}" OR text ~ "${variant}") AND type=page`,
        5,
      );
      if (searchResult.results.length > 0) break;
    } catch (err) {
      console.error(`Confluence search failed for "${variant}":`, err);
    }
  }

  if (searchResult.results.length === 0) {
    console.log(`Confluence: no FAQ pages found for service "${serviceName}" (tried: ${[...nameVariants].join(", ")})`);
    return [];
  }

  const results: Array<{
    id: string;
    title: string;
    url: string;
    content?: string;
  }> = [];

  const bestMatch = searchResult.results[0];
  try {
    const fullPage = await getPage(bestMatch.id, "body.storage,version");
    const bodyHtml = fullPage.body?.storage?.value ?? "";
    const plainText = bodyHtml
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    results.push({
      id: bestMatch.id,
      title: bestMatch.title,
      url: bestMatch._links.webui,
      content: plainText || undefined,
    });
  } catch {
    results.push({
      id: bestMatch.id,
      title: bestMatch.title,
      url: bestMatch._links.webui,
    });
  }

  for (const p of searchResult.results.slice(1)) {
    results.push({
      id: p.id,
      title: p.title,
      url: p._links.webui,
    });
  }

  return results;
}

async function fetchRecentChanges(
  repos: Array<{ owner: string; repo: string }>,
  minutesAgo: number,
) {
  const mergedAfter = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const allChanges: Array<{
    prNumber: number;
    title: string;
    author: string;
    url: string;
    commitSha: string;
    mergedAt: string;
    filesChanged: number;
  }> = [];

  for (const { owner, repo } of repos) {
    try {
      const prs = await listRecentPRs(owner, repo, { mergedAfter });
      allChanges.push(
        ...prs.map((pr) => ({
          prNumber: pr.number,
          title: pr.title,
          author: pr.user.login,
          url: pr.htmlUrl,
          commitSha: pr.mergeCommitSha ?? "",
          mergedAt: pr.mergedAt ?? "",
          filesChanged: pr.changedFiles,
        })),
      );
    } catch (err) {
      console.error(`Failed to fetch PRs from ${owner}/${repo}:`, err);
    }
  }

  return allChanges.sort(
    (a, b) =>
      new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime(),
  );
}
