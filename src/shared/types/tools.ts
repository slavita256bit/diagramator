export interface ToolStatus {
  name: string;
  path: string;
  /** `null` when the tool could not be executed. */
  version: string | null;
  source: "updated" | "bundled" | "system";
}
