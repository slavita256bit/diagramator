import { BaseEdge, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

/** Point where the line from `a`'s center towards `b`'s center leaves `a`'s border. */
function borderPoint(a: Rect, b: Rect) {
  const cx = a.x + a.w / 2;
  const cy = a.y + a.h / 2;
  const dx = b.x + b.w / 2 - cx;
  const dy = b.y + b.h / 2 - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  // Scale the direction vector until it hits the nearest side.
  const t = Math.min(
    dx === 0 ? Infinity : a.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : a.h / 2 / Math.abs(dy),
  );
  return { x: cx + dx * t, y: cy + dy * t };
}

const LOOP = 36;

/** Straight edge clipped to both node borders; self-relations get an orthogonal loop. */
export function FloatingEdge({ id, source, target, markerStart, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const s = rectOf(sourceNode);
  let path: string;
  if (source === target) {
    // Leave from the right side, come back into the top-right corner.
    const right = s.x + s.w;
    const startY = s.y + Math.min(24, s.h / 3);
    const endX = right - Math.min(40, s.w / 4);
    path = `M ${right},${startY} H ${right + LOOP} V ${s.y - LOOP} H ${endX} V ${s.y}`;
  } else {
    const t = rectOf(targetNode);
    const p1 = borderPoint(s, t);
    const p2 = borderPoint(t, s);
    path = `M ${p1.x},${p1.y} L ${p2.x},${p2.y}`;
  }
  return <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} style={style} />;
}
