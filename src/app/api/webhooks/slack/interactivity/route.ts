import { NextRequest, NextResponse, after } from "next/server";
import { generateObject, generateText } from "ai";
import { z } from "zod/v4";
import { verifySlackRequest } from "@/lib/slack-verify";
import { env } from "@/lib/env";
import { getModel } from "@/lib/agent";
import { resolveCheckpoint } from "@/lib/workflows/human-loop";
import { correlateAlerts } from "@/lib/workflows/alert-correlation";
import { extractEntities } from "@/lib/workflows/infra-triage";
import {
  buildAlertCorrelationExpansion,
  buildIncidentExpansion,
  buildGitHubChangesExpansion,
  buildSimilarIssuesResult,
  type SimilarIssueWithSummary,
} from "@/lib/providers/slack/blocks";
import {
  fetchChannelHistory,
  fetchThreadReplies,
  postMessage,
} from "@/lib/providers/slack/client";
import { getIncident, getIncidentTimeline } from "@/lib/providers/rootly/client";
import { listRecentPRs } from "@/lib/providers/github/client";
import { searchPages } from "@/lib/providers/confluence/client";
import { findSimilarIssues } from "@/lib/similarity/embeddings";
import { createFAQ } from "@/lib/db/queries/faqs";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (env.SLACK_SIGNING_SECRET && !verifySlackRequest(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const formData = new URLSearchParams(rawBody);
  const payloadStr = formData.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }
  const payload = JSON.parse(payloadStr);

  after(async () => {
    try {
      await handleInteraction(payload);
    } catch (err) {
      console.error("Error handling interaction:", err);
    }
  });

  return NextResponse.json({ ok: true });
}

async function handleInteraction(payload: {
  type: string;
  user: { id: string; name: string };
  channel: { id: string };
  message?: { ts: string; text: string; thread_ts?: string };
  actions?: Array<{ action_id: string; value: string }>;
  response_url: string;
}) {
  if (payload.type !== "block_actions" || !payload.actions?.length) return;

  const action = payload.actions[0];
  const channel = payload.channel.id;
  const threadTs = payload.message?.thread_ts ?? payload.message?.ts ?? "";

  switch (action.action_id) {
    case "analyze_alerts":
      await handleAnalyzeAlerts(action.value, channel, threadTs);
      break;
    case "show_changes":
      await handleShowChanges(action.value, channel, threadTs);
      break;
    case "view_incident":
      await handleViewIncident(action.value, channel, threadTs);
      break;
    case "search_faq":
      await handleSearchFAQ(action.value, channel, threadTs);
      break;
    case "search_previous_issues":
      await handleSearchPreviousIssues(action.value, channel, threadTs);
      break;
    case "draft_faq_from_similar":
      await handleDraftFAQFromSimilar(action.value, channel, threadTs, payload.user.name);
      break;
    case "approve_inline":
      await resolveCheckpoint(action.value, "approved", payload.user.name);
      await respondToSlack(payload.response_url, "Approved by " + payload.user.name);
      break;
    case "reject_inline":
      await resolveCheckpoint(action.value, "rejected", payload.user.name);
      await respondToSlack(payload.response_url, "Rejected by " + payload.user.name);
      break;
  }
}

// ---------------------------------------------------------------------------
// "Search Previous Related Issues" — the core on-demand handler
// ---------------------------------------------------------------------------

async function handleSearchPreviousIssues(
  serviceName: string,
  channel: string,
  threadTs: string,
) {
  await postMessage(
    channel,
    `:hourglass_flowing_sand: Searching previous help requests for issues similar to "${serviceName}"...`,
    { threadTs },
  );

  const model = getModel();
  const entities = await extractEntities(
    `${serviceName} is having issues`,
    model,
  );

  // Find semantically similar past issues using embedding similarity.
  // This matches by error pattern, not service name — so an OOM on
  // service-A will match a past OOM on service-B.
  const similarIssues = await findSimilarIssues({
    ...entities,
    rawMessage: serviceName,
    channel,
    threadTs,
    userId: "",
  });

  if (similarIssues.length === 0) {
    const blocks = buildSimilarIssuesResult({
      serviceName,
      issues: [],
      suggestedFix: null,
    });
    await postMessage(channel, "No similar previous issues found.", {
      threadTs,
      blocks,
    });
    return;
  }

  // For each similar issue, fetch the full thread conversation to learn
  // how the team actually resolved it
  const issuesWithConversations: Array<{
    issue: (typeof similarIssues)[0];
    replies: Array<{ text: string; user: string }>;
  }> = [];

  for (const issue of similarIssues.slice(0, 5)) {
    let replies: Array<{ text: string; user: string }> = [];
    if (issue.channel && issue.threadTs) {
      try {
        const msgs = await fetchThreadReplies(issue.channel, issue.threadTs);
        if (msgs.length > 1) {
          replies = msgs.slice(1).map((m) => ({
            text: m.text,
            user: m.user,
          }));
        }
      } catch {
        // Thread may be archived or bot lacks access
      }
    }
    issuesWithConversations.push({ issue, replies });
  }

  // Ask the LLM to summarize how each issue was fixed AND produce
  // an overall suggested fix based on the patterns
  const conversationContext = issuesWithConversations
    .map((ic, i) => {
      const repliesText =
        ic.replies.length > 0
          ? ic.replies
              .slice(0, 10)
              .map((r) => `  - ${r.user}: ${r.text}`)
              .join("\n")
          : "  (no replies found)";
      return `--- Issue ${i + 1} (${Math.round(ic.issue.similarity * 100)}% match, service: ${ic.issue.service}) ---\nDescription: ${ic.issue.description}\nReplies:\n${repliesText}`;
    })
    .join("\n\n");

  const fixSummarySchema = z.object({
    perIssueSummaries: z.array(
      z.object({
        issueIndex: z.number(),
        fixSummary: z.string(),
      }),
    ),
    overallSuggestedFix: z.string(),
  });

  let perIssueSummaries: Array<{ issueIndex: number; fixSummary: string }> = [];
  let overallSuggestedFix: string | null = null;

  try {
    const { object } = await generateObject({
      model,
      schema: fixSummarySchema,
      prompt: `You are analyzing ${issuesWithConversations.length} similar past infrastructure help requests.
For each issue, read the thread replies and summarize how it was fixed in 1-2 sentences.
Then provide an overall suggested fix based on the common resolution patterns.

If a thread has no replies or no clear resolution, say "No resolution recorded."
If replies contain specific commands (kubectl, terraform, docker, etc.), mention them.

Issues and their conversations:
${conversationContext}

Return:
- perIssueSummaries: one entry per issue (issueIndex 0-based) with a concise fixSummary
- overallSuggestedFix: a practical fix suggestion (2-3 sentences, include commands if applicable)`,
    });

    perIssueSummaries = object.perIssueSummaries;
    overallSuggestedFix = object.overallSuggestedFix;
  } catch (err) {
    console.error("Failed to generate fix summaries:", err);
  }

  // Build the result: each issue with link + fix summary
  const issuesForDisplay: SimilarIssueWithSummary[] =
    issuesWithConversations.map((ic, i) => ({
      service: ic.issue.service,
      description: ic.issue.description,
      similarity: ic.issue.similarity,
      channel: ic.issue.channel,
      threadTs: ic.issue.threadTs,
      createdAt: ic.issue.createdAt,
      fixSummary:
        perIssueSummaries.find((s) => s.issueIndex === i)?.fixSummary ?? null,
    }));

  const blocks = buildSimilarIssuesResult({
    serviceName,
    issues: issuesForDisplay,
    suggestedFix: overallSuggestedFix,
  });

  await postMessage(
    channel,
    `Found ${issuesForDisplay.length} similar previous help requests.`,
    { threadTs, blocks },
  );
}

// ---------------------------------------------------------------------------
// "Yes, Draft a FAQ Entry" — triggered after viewing similar issues
// ---------------------------------------------------------------------------

async function handleDraftFAQFromSimilar(
  serviceName: string,
  channel: string,
  threadTs: string,
  requestedBy: string,
) {
  const model = getModel();
  const entities = await extractEntities(
    `${serviceName} is having issues`,
    model,
  );

  const similarIssues = await findSimilarIssues({
    ...entities,
    rawMessage: serviceName,
    channel,
    threadTs,
    userId: "",
  });

  if (similarIssues.length === 0) {
    await postMessage(
      channel,
      `No similar past issues found for "${serviceName}" to base a FAQ on.`,
      { threadTs },
    );
    return;
  }

  // Fetch thread conversations for context
  const threadConversations: Array<{
    originalQuestion: string;
    replies: Array<{ text: string; user: string }>;
    similarity: number;
  }> = [];

  for (const issue of similarIssues.slice(0, 5)) {
    if (issue.channel && issue.threadTs) {
      try {
        const msgs = await fetchThreadReplies(issue.channel, issue.threadTs);
        if (msgs.length > 1) {
          threadConversations.push({
            originalQuestion: msgs[0].text,
            replies: msgs.slice(1).map((m) => ({
              text: m.text,
              user: m.user,
            })),
            similarity: issue.similarity,
          });
        }
      } catch {
        // Thread may be archived
      }
    }
  }

  const similarIssuesSummary = similarIssues
    .slice(0, 5)
    .map(
      (si, i) =>
        `${i + 1}. [${Math.round(si.similarity * 100)}% similar] ${si.description}` +
        (si.resolvedVia ? `\n   Resolution: ${si.resolvedVia}` : ""),
    )
    .join("\n");

  const conversationContext =
    threadConversations.length > 0
      ? threadConversations
          .map((tc, i) => {
            const repliesText = tc.replies
              .slice(0, 8)
              .map((r) => `  - ${r.user}: ${r.text}`)
              .join("\n");
            return `--- Thread ${i + 1} (${Math.round(tc.similarity * 100)}% match) ---\nQuestion: ${tc.originalQuestion}\nReplies:\n${repliesText}`;
          })
          .join("\n\n")
      : "No previous thread conversations found.";

  const { text: faqContent } = await generateText({
    model,
    prompt: `An infrastructure team member has requested a FAQ entry for "${serviceName}".
There have been ${similarIssues.length} similar past issues.

Similar past issues:
${similarIssuesSummary}

Previous resolution conversations (from Slack threads):
${conversationContext}

Based on the patterns in these similar issues and especially the actual resolution steps
from the team's Slack conversations, write a concise FAQ/runbook entry with:

1. Title (one line, descriptive)
2. Problem Description (2-3 sentences describing the symptoms)
3. Root Cause (based on what was discussed in the threads)
4. Resolution Steps (numbered, specific CLI commands or actions — extract these from the
   actual replies the team used)
5. Prevention (how to avoid this in the future)

Use plain text with markdown formatting. Be specific and actionable.
If threads contained specific commands or kubectl/terraform/docker commands, include them verbatim.`,
  });

  const titleMatch = faqContent.match(/^#?\s*(?:Title:\s*)?(.+)$/m);
  const title =
    titleMatch?.[1]?.trim() ?? `FAQ: ${serviceName} troubleshooting`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const faq = await createFAQ({
    title,
    content: faqContent,
    tags: [serviceName, ...entities.symptoms.slice(0, 3)],
    status: "draft",
    createdBy: requestedBy,
    relatedServices: [serviceName],
  });

  await db.insert(schema.auditLog).values({
    action: "faq_human_drafted",
    actor: requestedBy,
    actorType: "human",
    resourceType: "faq",
    resourceId: faq.id,
    details: {
      serviceName,
      similarIssueCount: similarIssues.length,
      threadConversationCount: threadConversations.length,
    },
  });

  await postMessage(
    channel,
    `FAQ draft created for "${serviceName}" — review and edit before publishing.`,
    {
      threadTs,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:memo: *FAQ Draft Created* (requested by <@${requestedBy}>)\nBased on *${similarIssues.length} similar past issues* and *${threadConversations.length} resolution conversations*.`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${title}*\n\`\`\`${faqContent.slice(0, 500)}${faqContent.length > 500 ? "..." : ""}\`\`\``,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Review & Edit FAQ",
                emoji: true,
              },
              url: `${appUrl}/faq/${faq.id}`,
              action_id: "review_faq_draft",
              style: "primary",
            },
          ],
        },
      ],
    },
  );
}

// ---------------------------------------------------------------------------
// Existing handlers
// ---------------------------------------------------------------------------

async function handleAnalyzeAlerts(serviceName: string, channel: string, threadTs: string) {
  const model = getModel();
  const entities = await extractEntities(`${serviceName} is having issues`, model);

  const alertChannels = await db.select().from(schema.alertChannels);
  const oldest = String(Math.floor(Date.now() / 1000) - 3600);

  const allAlerts: Array<{ text: string; ts: string }> = [];
  for (const ch of alertChannels) {
    try {
      const history = await fetchChannelHistory(ch.channelId, oldest, 200);
      allAlerts.push(...history.messages.map((m) => ({ text: m.text, ts: m.ts })));
    } catch { /* skip unavailable channels */ }
  }

  const result = await correlateAlerts(
    { ...entities, rawMessage: "", channel, threadTs, userId: "" },
    allAlerts,
    model,
  );

  const blocks = buildAlertCorrelationExpansion(result);
  await postMessage(channel, "Alert Correlation Analysis", { threadTs, blocks });
}

async function handleShowChanges(serviceName: string, channel: string, threadTs: string) {
  const repos = await db
    .select()
    .from(schema.serviceRepos)
    .where(eq(schema.serviceRepos.serviceName, serviceName));

  const allChanges: Array<{
    prNumber: number;
    title: string;
    author: string;
    url: string;
    commitSha: string;
    mergedAt: string;
    filesChanged: number;
  }> = [];

  const mergedAfter = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  for (const r of repos) {
    const [owner, repo] = r.repoFullName.split("/");
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
    } catch { /* skip unavailable repos */ }
  }

  const blocks = buildGitHubChangesExpansion(allChanges);
  await postMessage(channel, "Recent Code Changes", { threadTs, blocks });
}

async function handleViewIncident(incidentId: string, channel: string, threadTs: string) {
  try {
    const [incident, timeline] = await Promise.all([
      getIncident(incidentId),
      getIncidentTimeline(incidentId),
    ]);

    const blocks = buildIncidentExpansion({
      id: incident.id,
      title: incident.attributes.title,
      severity: incident.attributes.severity?.name ?? "Unknown",
      status: incident.attributes.status,
      commander: incident.attributes.commander?.name,
      slackChannel: incident.attributes.slack_channel_id,
      startedAt: incident.attributes.started_at,
      services: incident.attributes.services?.map((s) => s.name) ?? [],
      timelineEntries: timeline.slice(0, 5).map((e) => ({
        time: e.attributes.created_at,
        text: e.attributes.content,
      })),
    });

    await postMessage(channel, `Incident ${incidentId} Details`, { threadTs, blocks });
  } catch (err) {
    await postMessage(channel, `Failed to fetch incident details: ${err}`, { threadTs });
  }
}

async function handleSearchFAQ(serviceName: string, channel: string, threadTs: string) {
  try {
    const result = await searchPages(`type=page AND text ~ "${serviceName}"`, 5);

    if (result.results.length === 0) {
      await postMessage(channel, `No FAQ entries found for "${serviceName}".`, { threadTs });
      return;
    }

    const text = result.results.map((p) => `- <${p._links.webui}|${p.title}>`).join("\n");
    await postMessage(channel, `FAQ matches for "${serviceName}":\n${text}`, { threadTs });
  } catch {
    await postMessage(channel, `Could not search FAQ. Check Confluence configuration.`, { threadTs });
  }
}

async function respondToSlack(responseUrl: string, text: string) {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, replace_original: false, response_type: "ephemeral" }),
  });
}
