import { BaseEdge, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import type { Point } from "@/shared/types";
import { selfLoop, straightLine, type Rect } from "../lib/routing";

function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

/**
 * Draws the router's polyline (`data.route`, same geometry as the Typst export).
 * While an end is being dragged the stored route is stale, so a live straight line is shown
 * until the drop triggers re-routing.
 */
export function FloatingEdge({ id, source, target, markerStart, markerEnd, style, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const route = (data as { route?: Point[] } | undefined)?.route;
  const dragging = sourceNode.dragging || targetNode.dragging;
  const s = rectOf(sourceNode);
  const pts =
    route && route.length >= 2 && !dragging
      ? route
      : source === target
        ? selfLoop(s)
        : straightLine(s, rectOf(targetNode));
  const path = pts.map((p, i) => `${i ? "L" : "M"} ${p.x},${p.y}`).join(" ");
  return <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} style={style} />;
}
