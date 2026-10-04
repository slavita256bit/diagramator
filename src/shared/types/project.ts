import type { Diagram } from "./diagram";
import type { StyleProfile } from "./style";

/** `diagramator.json` — mirrors `crates/diagram-core/src/project.rs`. */
export interface ProjectFile {
  version: number;
  /** Typst output, relative to the project folder. */
  output: string;
  autoExport: boolean;
  style: StyleProfile | null;
  positions: Record<string, { x: number; y: number }>;
  collapsed: Record<string, { attributes: boolean; methods: boolean }>;
  notes: Diagram["notes"];
}

export interface OpenedProject {
  /** Saved positions already applied. */
  diagram: Diagram;
  project: ProjectFile | null;
}
