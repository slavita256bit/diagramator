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
  position: Position;
}

/** `source` is the dependent side (child / whole / user). */
export interface Relation {
  source: string;
  target: string;
  type: RelationType;
}

export interface Diagram {
  classes: ClassNode[];
  relations: Relation[];
}
