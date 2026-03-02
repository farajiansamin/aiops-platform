import { env } from "@/lib/env";
import type {
  RootlyIncident,
  RootlyTimelineEvent,
  RootlyListResponse,
  RootlySingleResponse,
} from "./types";

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${env.ROOTLY_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function baseUrl(): string {
  return env.ROOTLY_BASE_URL ?? "https://api.rootly.com";
}

async function fetchRootly<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}/v1${path}`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Rootly API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function searchIncidents(params: {
  services?: string[];
  statuses?: string[];
  startedAfter?: string;
}): Promise<RootlyIncident[]> {
  const searchParams = new URLSearchParams();
  if (params.statuses?.length) {
    searchParams.set(
      "filter[status]",
      params.statuses.join(","),
    );
  }
  if (params.startedAfter) {
    searchParams.set("filter[started_at][gt]", params.startedAfter);
  }
  searchParams.set("page[size]", "25");

  const result = await fetchRootly<RootlyListResponse<RootlyIncident>>(
    `/incidents?${searchParams.toString()}`,
  );

  let incidents = result.data;

  if (params.services?.length) {
    const serviceSet = new Set(params.services.map((s) => s.toLowerCase()));
    incidents = incidents.filter((inc) =>
      inc.attributes.services?.some((s) =>
        serviceSet.has(s.name.toLowerCase()),
      ) ?? inc.attributes.title.toLowerCase().split(" ").some((w) => serviceSet.has(w)),
    );
  }

  return incidents;
}

export async function getIncident(
  incidentId: string,
): Promise<RootlyIncident> {
  const result = await fetchRootly<RootlySingleResponse<RootlyIncident>>(
    `/incidents/${incidentId}`,
  );
  return result.data;
}

export async function getIncidentTimeline(
  incidentId: string,
): Promise<RootlyTimelineEvent[]> {
  const result = await fetchRootly<RootlyListResponse<RootlyTimelineEvent>>(
    `/incidents/${incidentId}/timeline_events?page[size]=50`,
  );
  return result.data;
}
