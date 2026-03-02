export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string; emailAddress: string };
    reporter?: { displayName: string };
    created: string;
    updated: string;
    issuetype: { name: string };
    project: { key: string; name: string };
    labels?: string[];
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export interface JiraCreateIssueInput {
  projectKey: string;
  summary: string;
  description?: string;
  issueType?: string;
  priority?: string;
  labels?: string[];
  assigneeEmail?: string;
}
