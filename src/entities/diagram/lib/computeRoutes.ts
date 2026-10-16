import type { Diagram, Point, StyleProfile } from "@/shared/types";
import { routeEdges, type Rect } from "./routing";
import { routeInWorker, type RoutingRequest } from "./routingWorker";

function prepare(diagram: Diagram, style: StyleProfile) {
  const boxes: [string, Rect][] = diagram.classes.filter((c) => !c.hidden).map((c) => [
    c.id, { x: c.position.x, y: c.position.y, w: c.position.width, h: c.position.height },
  ]);
  const ids = new Set(boxes.map(([id]) => id));
  const known = diagram.relations.filter((r) => ids.has(r.source) && ids.has(r.target));
  const input: RoutingRequest = {
    boxes,
    edges: known.map(({ source, target, type, anchors }) => ({ source, target, type, anchors })),
    orthogonal: style.orthogonalEdges,
    options: {
      edgeMergeTargets: style.edgeMergeTargets, edgeClearance: style.edgeClearance,
      edgePortSpacing: style.edgePortSpacing, edgeBendPenalty: style.edgeBendPenalty,
      edgeSourceSide: style.edgeSourceSide, edgeTargetSide: style.edgeTargetSide,
    },
  };
  const align = (routes: Point[][]) => {
    const byRelation = new Map(known.map((r, i) => [r, routes[i]]));
    return diagram.relations.map((r) => byRelation.get(r) ?? []);
  };
  return { input, align };
}

/** Synchronous variant for small local previews and environments without Workers. */
export function computeRoutes(diagram: Diagram, style: StyleProfile): Point[][] {
  const { input, align } = prepare(diagram, style);
  return align(routeEdges({ ...input, boxes: new Map(input.boxes) }));
}

/** Same geometry off the UI thread. Cancellation discards obsolete drag frames. */
export async function computeRoutesAsync(diagram: Diagram, style: StyleProfile, signal?: AbortSignal): Promise<Point[][]> {
  const { input, align } = prepare(diagram, style);
  const routes = await routeInWorker(input, () => routeEdges({ ...input, boxes: new Map(input.boxes) }), signal);
  return align(routes);
}
