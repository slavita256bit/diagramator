/** Flowchart geometry uses millimeters and node coordinates refer to symbol centers. */
export interface FlowchartPoint { x: number; y: number }
export type FlowchartSide = "top" | "bottom" | "left" | "right";
export type FlowchartNodeKind = "terminal" | "process" | "predefined" | "decision" | "input-output" | "loop-start" | "loop-end" | "connector";
export interface FlowchartNode {
  id: string;
  kind: FlowchartNodeKind;
  position: FlowchartPoint;
  /** Plain text with newline-separated lines, rendered in the document's normal typeface. */
  text: string;
  textSize?: number;
  emphasis?: { text: string; size: number };
}
export type FlowchartRoutePoint =
  | { node: string; side: FlowchartSide }
  | { junction: string }
  | (FlowchartPoint & { alignX?: string; alignY?: string });
export interface FlowchartJunction {
  id: string;
  position: FlowchartPoint;
  anchor?: { node: string; side: FlowchartSide };
}
export interface FlowchartRoute {
  id: string;
  points: FlowchartRoutePoint[];
  arrow: boolean;
  automatic?: boolean;
}
export interface FlowchartLabel {
  id: string;
  position: FlowchartPoint;
  width: number;
  text: string;
  anchor?:
    | { node: string; side: FlowchartSide; route?: string; along?: number }
    | { route: string; along: number };
}
export interface FlowchartComment {
  id: string;
  node: string;
  side: "left" | "right";
  gap: number;
  width: number;
  height: number;
  text: string;
}
export interface Flowchart {
  version: 1;
  canvas: { width: number; height: number; textSize: number };
  nodes: FlowchartNode[];
  routes: FlowchartRoute[];
  junctions?: FlowchartJunction[];
  labels: FlowchartLabel[];
  comments: FlowchartComment[];
}
