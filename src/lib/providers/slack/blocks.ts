import type { RootlyIncidentSummary } from "./types";

interface AlertCorrelationResult {
  relatedAlertCount: number;
  categories: Array<{
    name: string;
    count: number;
    severity: "info" | "warning" | "critical";
  }>;
  suspectedRootCause: string;
  suggestion: string;
}

function slackMessagePermalink(channel: string, ts: string): string {
  const tsNoDot = ts.replace(".", "");
  return `https://app.slack.com/archives/${channel}/p${tsNoDot}`;
}

// ---------------------------------------------------------------------------
// Initial triage response — posted automatically when a help request arrives
// ---------------------------------------------------------------------------

export function buildTriageResponse(params: {
  serviceName: string;
  alertCount: number;
  alertChannelId?: string;
  hasRecentChanges: boolean;
  changeCount?: number;
  hasFAQMatch: boolean;
  faqFixContent?: string;
  faqTitle?: string;
  faqUrl?: string;
  relatedIncidents: RootlyIncidentSummary[];
  threadTs: string;
}): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  // Incident banner (highest priority, shown at top)
  for (const inc of params.relatedIncidents) {
    const isActive = ["started", "investigating", "mitigated"].includes(
      inc.status,
    );
    const severityEmoji =
      inc.severity === "P0" || inc.severity === "P1" ? ":red_circle:" : ":large_orange_circle:";
    const statusLabel = isActive ? "Active" : `Resolved`;

    if (isActive) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${severityEmoji} *INCIDENT LINKED: ${inc.id} (${inc.severity}, ${statusLabel})*\n>${inc.title}\n>Commander: ${inc.commander ?? "Unassigned"} | Started: ${inc.startedAt}${inc.slackChannel ? `\n>Channel: <#${inc.slackChannel}>` : ""}`,
        },
      });
    } else {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `:information_source: This may be related to *${inc.id}* (${inc.severity}, Resolved ${inc.resolvedAt ?? "recently"}). If symptoms persist, consider reopening.`,
        },
      });
    }
    blocks.push({ type: "divider" });
  }

  // Summary section
  const summaryParts: string[] = [
    `I see you're having issues with *${params.serviceName}*.`,
  ];
  if (params.alertCount > 0) {
    const alertLink = params.alertChannelId
      ? `Found *${params.alertCount} related alerts* in <#${params.alertChannelId}> that didn't trigger an incident.`
      : `Found *${params.alertCount} related alerts* that didn't trigger an incident.`;
    summaryParts.push(alertLink);
  }
  if (params.hasRecentChanges) {
    summaryParts.push(
      `Found *${params.changeCount ?? "recent"} code change(s)* in the relevant repo.`,
    );
  }
  if (params.relatedIncidents.length === 0) {
    summaryParts.push("No active Rootly incident found for this service.");
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: summaryParts.join("\n") },
  });

  // FAQ fix content — shown inline when a match is found
  if (params.hasFAQMatch && params.faqFixContent) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:book: *Known Fix Found:* ${params.faqTitle ? `<${params.faqUrl ?? "#"}|${params.faqTitle}>` : "FAQ Match"}`,
      },
    });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`\`\`${params.faqFixContent.slice(0, 2500)}\`\`\``,
      },
    });
  }

  // When no FAQ match, explicitly tell the user and offer to search past issues
  if (!params.hasFAQMatch || !params.faqFixContent) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:page_facing_up: *No similar FAQ entry found* for this issue. Would you like me to search previous help requests for similar problems?`,
      },
    });
  }

  // Action buttons
  const actions: Record<string, unknown>[] = [];

  if (
    params.relatedIncidents.some((i) =>
      ["started", "investigating", "mitigated"].includes(i.status),
    )
  ) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "View Incident", emoji: true },
      action_id: "view_incident",
      value: params.relatedIncidents[0]?.id ?? "",
    });
  }

  if (params.alertCount > 0) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Analyze Related Alerts",
        emoji: true,
      },
      action_id: "analyze_alerts",
      value: params.serviceName,
    });
  }

  if (params.hasRecentChanges) {
    actions.push({
      type: "button",
      text: { type: "plain_text", text: "View Recent Commits", emoji: true },
      action_id: "show_changes",
      value: params.serviceName,
    });
  }

  // "Search Previous Related Issues" — always available; prominent when no FAQ
  if (!params.hasFAQMatch || !params.faqFixContent) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Search Previous Related Issues",
        emoji: true,
      },
      action_id: "search_previous_issues",
      value: params.serviceName,
      style: "primary",
    });
  } else {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "Search Previous Issues",
        emoji: true,
      },
      action_id: "search_previous_issues",
      value: params.serviceName,
    });
  }

  blocks.push({ type: "actions", elements: actions });

  return blocks;
}

// ---------------------------------------------------------------------------
// Similar issues expansion — posted when user clicks "Search Previous Issues"
// ---------------------------------------------------------------------------

export interface SimilarIssueWithSummary {
  service: string;
  description: string;
  similarity: number;
  channel: string | null;
  threadTs: string | null;
  createdAt: Date;
  fixSummary: string | null;
}

export function buildSimilarIssuesResult(params: {
  serviceName: string;
  issues: SimilarIssueWithSummary[];
  suggestedFix: string | null;
}): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  if (params.issues.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:mag: No similar previous help requests found for this issue pattern. This may be a new type of issue.`,
      },
    });
    return blocks;
  }

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Found ${params.issues.length} Similar Previous Issue${params.issues.length > 1 ? "s" : ""}`,
      emoji: true,
    },
  });

  // List each similar issue with link + fix summary
  for (const si of params.issues.slice(0, 5)) {
    const pct = Math.round(si.similarity * 100);
    const date = si.createdAt.toISOString().slice(0, 10);
    const svcLabel =
      si.service !== params.serviceName ? ` _(on ${si.service})_` : "";
    const desc = si.description.slice(0, 150);

    let line: string;
    if (si.channel && si.threadTs) {
      const link = slackMessagePermalink(si.channel, si.threadTs);
      line = `*[${pct}% match]* <${link}|View original thread>${svcLabel} — ${date}\n>${desc}`;
    } else {
      line = `*[${pct}% match]* ${desc}${svcLabel} — ${date}`;
    }

    if (si.fixSummary) {
      line += `\n>:white_check_mark: *How it was fixed:* ${si.fixSummary}`;
    }

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: line },
    });
  }

  // If the LLM produced an overall suggested fix, show it
  if (params.suggestedFix) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:bulb: *Suggested Fix (based on ${params.issues.length} previous resolution${params.issues.length > 1 ? "s" : ""}):*\n${params.suggestedFix}`,
      },
    });
  }

  // Offer to draft a FAQ
  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:memo: This issue pattern has appeared *${params.issues.length} time${params.issues.length > 1 ? "s" : ""}* before. Would you like to add it to the FAQ so the fix is documented for next time?`,
    },
  });
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Yes, Draft a FAQ Entry",
          emoji: true,
        },
        action_id: "draft_faq_from_similar",
        value: params.serviceName,
        style: "primary",
      },
    ],
  });

  return blocks;
}

// ---------------------------------------------------------------------------
// Alert correlation expansion
// ---------------------------------------------------------------------------

export function buildAlertCorrelationExpansion(
  result: AlertCorrelationResult,
  dashboardUrl?: string,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: "header",
    text: { type: "plain_text", text: "Alert Correlation Summary", emoji: true },
  });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Suspected Root Cause:* ${result.suspectedRootCause}`,
    },
  });

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Correlated Events (${result.relatedAlertCount} alerts):*`,
    },
  });

  for (const cat of result.categories) {
    const severityIcon =
      cat.severity === "critical"
        ? ":red_circle:"
        : cat.severity === "warning"
          ? ":large_yellow_circle:"
          : ":large_blue_circle:";
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${severityIcon} *${cat.count}x* ${cat.name}`,
      },
    });
  }

  blocks.push({ type: "divider" });

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*AI Suggestion:* ${result.suggestion}`,
    },
  });

  if (dashboardUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Open in Dashboard",
            emoji: true,
          },
          url: dashboardUrl,
          action_id: "open_dashboard",
        },
      ],
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Incident expansion
// ---------------------------------------------------------------------------

export function buildIncidentExpansion(incident: {
  id: string;
  title: string;
  severity: string;
  status: string;
  commander?: string;
  slackChannel?: string;
  startedAt: string;
  services: string[];
  timelineEntries: Array<{ time: string; text: string }>;
}): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `${incident.id} Details`, emoji: true },
  });

  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Severity:* ${incident.severity}` },
      { type: "mrkdwn", text: `*Status:* ${incident.status}` },
      {
        type: "mrkdwn",
        text: `*Commander:* ${incident.commander ?? "Unassigned"}`,
      },
      {
        type: "mrkdwn",
        text: `*Services:* ${incident.services.join(", ") || "N/A"}`,
      },
    ],
  });

  if (incident.slackChannel) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Join the incident channel: <#${incident.slackChannel}>`,
      },
    });
  }

  if (incident.timelineEntries.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Recent Timeline (${incident.timelineEntries.length} entries):*`,
      },
    });
    const timelineText = incident.timelineEntries
      .slice(0, 5)
      .map((e) => `• _${e.time}_ - ${e.text}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: timelineText },
    });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// GitHub changes expansion
// ---------------------------------------------------------------------------

export function buildGitHubChangesExpansion(
  changes: Array<{
    prNumber: number;
    title: string;
    author: string;
    url: string;
    commitSha: string;
    mergedAt: string;
    filesChanged: number;
  }>,
): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: "header",
    text: { type: "plain_text", text: "Recent Code Changes", emoji: true },
  });

  if (changes.length === 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: "No recent code changes found." },
    });
    return blocks;
  }

  for (const change of changes) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${change.url}|PR #${change.prNumber}>* by @${change.author}\n>${change.title}\n>Commit: \`${change.commitSha.slice(0, 7)}\` | Merged: ${change.mergedAt} | ${change.filesChanged} files changed`,
      },
    });
  }

  return blocks;
}
