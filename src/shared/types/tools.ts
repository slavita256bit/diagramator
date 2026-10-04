export interface ToolStatus {
  name: string;
  path: string;
  /** `null` when the tool could not be executed. */
  version: string | null;
  source: "updated" | "bundled" | "system";
}

export interface ToolUpdate {
  name: string;
  current: string | null;
  latest: string;
  available: boolean;
}
