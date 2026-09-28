/** Rendering style profile — mirrors `crates/diagram-core/src/style.rs`. Lengths in editor px. */
export interface StyleProfile {
  styleVersion: number;
  name: string;
  /** Font families in priority order. */
  font: string[];
  fontSize: number;
  nameFontSize: number;
  stereotypeFontSize: number;
  lineHeight: number;
  paddingX: number;
  paddingY: number;
  borderWidth: number;
  cornerRadius: number;
  nameBold: boolean;
  /** PlantUML-style circled kind letter before the class name. */
  kindBadge: boolean;
  colors: StyleColors;
  edgeWidth: number;
  arrowSize: number;
}

export interface StyleColors {
  text: string;
  border: string;
  fill: string;
  headerFill: string;
  edge: string;
  badge: string;
}
