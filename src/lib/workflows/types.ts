export interface HumanCheckpoint {
  id: string;
  workflowId: string;
  type:
    | "execution_authority"
    | "knowledge_approval"
    | "data_validation"
    | "tone_calibration";
  summary: string;
  detailUrl: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  decidedBy?: string;
  decidedAt?: Date;
}

export interface ExtractedEntities {
  service: string;
  timeframe: string;
  minutesAgo: number;
  symptoms: string[];
  isTerraform: boolean;
  terraformResource?: string;
  rawMessage: string;
  channel: string;
  threadTs: string;
  userId: string;
}

export interface AlertCategory {
  name: string;
  count: number;
  severity: "info" | "warning" | "critical";
  samples: Array<{ text: string; ts: string }>;
}

export interface AlertCorrelationResult {
  relatedAlertCount: number;
  categories: AlertCategory[];
  suspectedRootCause: string;
  timeline: Array<{ time: string; text: string; category: string }>;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

export interface TriageContext {
  entities: ExtractedEntities;
  alertCorrelation?: AlertCorrelationResult;
  relatedIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    commander?: string;
    slackChannel?: string;
    startedAt: string;
    resolvedAt?: string;
    services: string[];
  }>;
  recentChanges: Array<{
    prNumber: number;
    title: string;
    author: string;
    url: string;
    commitSha: string;
    mergedAt: string;
    filesChanged: number;
  }>;
  faqMatches: Array<{
    id: string;
    title: string;
    url: string;
  }>;
  historicalThreads: Array<{
    text: string;
    ts: string;
    channel: string;
    replies?: Array<{ text: string; user: string }>;
  }>;
}
