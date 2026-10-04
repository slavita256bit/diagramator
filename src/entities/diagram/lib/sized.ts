import type { Diagram, StyleProfile } from "@/shared/types";
import { measureClass } from "./measure";

/** Applies current-style pixel sizes to every class box; Rust's layout only estimates them. */
export function sizeDiagram(diagram: Diagram, style: StyleProfile): Diagram {
  for (const c of diagram.classes) Object.assign(c.position, measureClass(c, style));
  return diagram;
}
