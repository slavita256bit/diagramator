import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, useInternalNode, useReactFlow, type EdgeProps, type InternalNode } from "@xyflow/react";
import type { Point, RelationAnchors } from "@/shared/types";
import { useAppDispatch } from "@/shared/model/hooks";
import { relationAnchorsChanged } from "../model/diagramSlice";
import { nearestAnchor, snapAnchor, routeEdges, selfLoop, straightLine, type Rect, type RoutingOptions } from "../lib/routing";

function rectOf(node: InternalNode): Rect {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, w: node.measured.width ?? 0, h: node.measured.height ?? 0 };
}

interface ConnectionData {
  route?: Point[];
  anchors?: RelationAnchors;
  orthogonal?: boolean;
  editable?: boolean;
  relationIndex?: number;
  routingOptions?: RoutingOptions;
  live?: boolean;
}

/** The stored route is also used by Typst. Manual attachments remain relative to the box. */
export function FloatingEdge({ id, source, target, markerStart, markerEnd, style, data, selected }: EdgeProps) {
  const dispatch = useAppDispatch();
  const { screenToFlowPosition, getZoom } = useReactFlow();
  const [preview, setPreview] = useState<RelationAnchors | null>(null);
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { route, anchors, orthogonal, editable, relationIndex, routingOptions, live } = (data as ConnectionData | undefined) ?? {};
  const dragging = sourceNode.dragging || targetNode.dragging;
  const s = rectOf(sourceNode), t = rectOf(targetNode);
  const pts = !preview && route && route.length >= 2 && (!dragging || live)
    ? route
    : orthogonal
      ? routeEdges({ boxes: new Map([[source, s], [target, t]]),
        edges: [{ source, target, anchors: preview ?? anchors }], orthogonal: true, options: routingOptions })[0]
      : source === target ? selfLoop(s) : straightLine(s, t);
  const path = pts.map((p, i) => `${i ? "L" : "M"} ${p.x},${p.y}`).join(" ");
  const commit = (value: RelationAnchors) => {
    if (relationIndex !== undefined) {
      dispatch(relationAnchorsChanged({ index: relationIndex,
        anchors: value.source || value.target ? value : undefined }));
    }
  };
  const atPointer = (e: ReactPointerEvent<HTMLButtonElement>, end: "source" | "target") => {
    const box = end === "source" ? s : t;
    const anchor = nearestAnchor(screenToFlowPosition({ x: e.clientX, y: e.clientY }), box);
    return { ...anchors, [end]: snapAnchor(anchor, box, getZoom(), e.shiftKey) };
  };

  return (
    <>
      <BaseEdge id={id} path={path} markerStart={markerStart} markerEnd={markerEnd} style={style} />
      {selected && orthogonal && editable && relationIndex !== undefined && <EdgeLabelRenderer>{(["source", "target"] as const).map((end) => {
        const p = end === "source" ? pts[0] : pts[pts.length - 1];
        return <button key={end} type="button" title="Drag to attach. Snaps near 25%, 50%, 75%; hold Shift to lock to these points. Double-click to reset."
          className="nodrag nopan" style={{ position: "absolute", zIndex: 1001, transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
            width: 14, height: 14, padding: 0, border: "2px solid #1976d2", borderRadius: "50%", background: "white",
            cursor: "grab", pointerEvents: "all", touchAction: "none" }}
          role="slider" tabIndex={0} aria-label={`Move ${end} connection`} aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round((preview?.[end]?.offset ?? anchors?.[end]?.offset ?? 0.5) * 100)}
          onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setPreview(atPointer(e, end)); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setPreview(atPointer(e, end)); }}
          onPointerUp={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            e.stopPropagation(); e.currentTarget.releasePointerCapture(e.pointerId);
            commit(atPointer(e, end)); setPreview(null);
          }}
          onPointerCancel={() => setPreview(null)}
          onDoubleClick={(e) => { e.stopPropagation(); commit({ ...anchors, [end]: undefined }); }}
          onKeyDown={(e) => {
            if (e.key === "Home" || e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault(); e.stopPropagation(); commit({ ...anchors, [end]: undefined });
            } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault(); e.stopPropagation();
              const current = anchors?.[end] ?? nearestAnchor(p, end === "source" ? s : t);
              const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -0.05 : 0.05;
              commit({ ...anchors, [end]: { ...current, offset: Math.max(0.03, Math.min(0.97, current.offset + delta)) } });
            }
          }} />;
      })}</EdgeLabelRenderer>}
    </>
  );
}
