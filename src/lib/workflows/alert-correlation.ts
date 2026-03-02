import { generateObject, type LanguageModel } from "ai";
// LanguageModel type includes LanguageModelV2 | LanguageModelV3 | string
import { z } from "zod/v4";
import type { ExtractedEntities, AlertCorrelationResult } from "./types";

const alertCorrelationSchema = z.object({
  relatedAlertCount: z.number(),
  categories: z.array(
    z.object({
      name: z.string(),
      count: z.number(),
      severity: z.enum(["info", "warning", "critical"]),
      sampleTexts: z.array(z.string()),
    }),
  ),
  suspectedRootCause: z.string(),
  suggestion: z.string(),
  severity: z.enum(["low", "medium", "high"]),
});

export async function correlateAlerts(
  entities: ExtractedEntities,
  rawAlerts: Array<{ text: string; ts: string }>,
  model: LanguageModel,
): Promise<AlertCorrelationResult> {
  if (rawAlerts.length === 0) {
    return {
      relatedAlertCount: 0,
      categories: [],
      suspectedRootCause: "No alerts found in the specified time window.",
      timeline: [],
      suggestion: "Check if alerting is configured for this service.",
      severity: "low",
    };
  }

  const alertTexts = rawAlerts
    .slice(0, 200)
    .map((a, i) => `[${i + 1}] ${a.text}`)
    .join("\n");

  const { object } = await generateObject({
    model,
    schema: alertCorrelationSchema,
    prompt: `You are analyzing infrastructure alerts to find which ones are related to a help request.

Help Request Context:
- Service: ${entities.service}
- Timeframe: ${entities.timeframe} (last ${entities.minutesAgo} minutes)
- Symptoms: ${entities.symptoms.join(", ")}
${entities.isTerraform ? `- Terraform Resource: ${entities.terraformResource}` : ""}

Here are ${rawAlerts.length} alert messages from the monitoring channels in the relevant time window:

${alertTexts}

Analyze these alerts and:
1. Identify which alerts are semantically related to the "${entities.service}" service and the reported symptoms
2. Group related alerts by category (e.g., "ECS Task Stopped (OOMKilled)", "Lambda Timeout", "Autoscaling Event")
3. Assign severity to each category (info, warning, critical)
4. Determine a suspected root cause based on the pattern of alerts
5. Suggest an actionable next step for the infrastructure team
6. Rate the overall severity (low, medium, high)

Only include alerts that are plausibly related to the service in question. Ignore unrelated noise.`,
  });

  return {
    relatedAlertCount: object.relatedAlertCount,
    categories: object.categories.map((c) => ({
      name: c.name,
      count: c.count,
      severity: c.severity,
      samples: c.sampleTexts.map((t) => ({
        text: t,
        ts: "",
      })),
    })),
    suspectedRootCause: object.suspectedRootCause,
    timeline: [],
    suggestion: object.suggestion,
    severity: object.severity,
  };
}
