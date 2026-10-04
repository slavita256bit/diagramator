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
  /** Route edges with horizontal/vertical segments only. */
  orthogonalEdges: boolean;
  edgeWidth: number;
  arrowSize: number;
  /** Dash/gap length of dashed edges (realization, dependency, note connectors). */
  edgeDashLength: number;
  edgeDashGap: number;
  /** GOST: interfaces omit the attributes compartment entirely (not just empty). */
  interfaceHidesAttributes: boolean;
  /** Show the «interface»/«struct»/etc. stereotype text above the class name. */
  showStereotype: boolean;
  templateNotation: TemplateNotation;
  memberIconStyle: MemberIconStyle;
  showMethodParams: boolean;
  showMethodReturnType: boolean;
}

/** `none`: template params stay out of the display name. `corner`: GOST's dashed
 * corner box. `header`: `template<...>` row above the name (PlantUML-style). */
export type TemplateNotation = "none" | "corner" | "header";

/** `text`: plain +/-/# prefix (GOST). `shape`: VS-style square/circle by access.
 * `circle`: PlantUML-style colored circle per member. */
export type MemberIconStyle = "text" | "shape" | "circle";

export interface StyleColors {
  text: string;
  border: string;
  fill: string;
  headerFill: string;
  edge: string;
  badge: string;
}
