/** Diagram IR — mirrors `crates/diagram-core/src/ir.rs`. */

export type ClassKind = "class" | "struct" | "interface" | "enum" | "union";

export type RelationType =
  | "inheritance"
  | "realization"
  | "composition"
  | "aggregation"
  | "association"
  | "dependency";

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClassNode {
  id: string;
  name: string;
  kind: ClassKind;
  /** UML-formatted, e.g. `- x: int`. */
  attributes: string[];
  /** UML-formatted, e.g. `+ calculate(): void`. */
  methods: string[];
  /** Template/generic parameter names (e.g. `["T", "Alloc"]`); empty if not a template. */
  templateParams: string[];
  attributesCollapsed: boolean;
  methodsCollapsed: boolean;
  position: Position;
}

/** A freestanding comment box, optionally attached to one class with a dashed
 * connector (GOST fig 4.5's `{comment}` box). Not derived from Doxygen. */
export interface Note {
  id: string;
  text: string;
  position: Position;
  linkedClass?: string;
  /** Attached image as a data URI (`data:image/png;base64,...`); embedded directly in
   * `diagramator.json` and in the exported Typst document (no separate asset file). */
  image?: string;
}

/** `source` is the dependent side (child / whole / user). */
export interface Relation {
  source: string;
  target: string;
  type: RelationType;
  /** Polyline source border → target border from the edge router; absent = straight line. */
  route?: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Diagram {
  classes: ClassNode[];
  relations: Relation[];
  notes: Note[];
}
