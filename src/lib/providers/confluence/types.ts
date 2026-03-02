export interface ConfluencePage {
  id: string;
  type: string;
  status: string;
  title: string;
  space: { key: string; name: string };
  body?: {
    storage?: { value: string };
    view?: { value: string };
  };
  version: { number: number };
  _links: { webui: string; self: string };
}

export interface ConfluenceSearchResult {
  results: ConfluencePage[];
  totalSize: number;
  start: number;
  limit: number;
}
