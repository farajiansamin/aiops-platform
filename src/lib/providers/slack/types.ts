export interface SlackMessage {
  ts: string;
  text: string;
  user: string;
  channel: string;
  threadTs?: string;
  blocks?: SlackBlock[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: SlackBlockElement[];
  accessory?: SlackBlockElement;
  block_id?: string;
}

export interface SlackBlockElement {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  action_id?: string;
  value?: string;
  url?: string;
  style?: string;
}

export interface SlackChannelHistory {
  messages: SlackMessage[];
  hasMore: boolean;
  responseMetadata?: { nextCursor?: string };
}

export interface SlackSearchResult {
  messages: {
    matches: SlackMessage[];
    total: number;
  };
}

export interface SlackInteractionPayload {
  type: string;
  trigger_id: string;
  user: { id: string; name: string };
  channel: { id: string; name: string };
  message: SlackMessage;
  actions: Array<{
    action_id: string;
    value: string;
    block_id: string;
  }>;
  response_url: string;
}

export interface RootlyIncidentSummary {
  id: string;
  title: string;
  severity: string;
  status: string;
  commander?: string;
  slackChannel?: string;
  startedAt: string;
  resolvedAt?: string;
}
