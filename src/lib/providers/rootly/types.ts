export interface RootlyIncident {
  id: string;
  type: "incidents";
  attributes: {
    title: string;
    summary?: string;
    severity?: { name: string };
    status: string;
    started_at: string;
    resolved_at?: string;
    mitigated_at?: string;
    commander?: { name: string; email: string };
    slack_channel_id?: string;
    slack_channel_name?: string;
    services?: Array<{ name: string }>;
    environments?: Array<{ name: string }>;
    url?: string;
  };
}

export interface RootlyTimelineEvent {
  id: string;
  type: "timeline_events";
  attributes: {
    kind: string;
    created_at: string;
    content: string;
    user?: { name: string };
  };
}

export interface RootlyListResponse<T> {
  data: T[];
  meta?: { total_count: number; current_page: number; total_pages: number };
}

export interface RootlySingleResponse<T> {
  data: T;
}
