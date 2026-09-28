import type { Diagram, Point } from "@/shared/types";
import { routeEdges, type Rect } from "./routing";

/** Routes for every relation of `diagram`, index-aligned with `diagram.relations`. */
export function computeRoutes(diagram: Diagram, orthogonal: boolean): Point[][] {
  const boxes = new Map<string, Rect>(
    diagram.classes.map((c) => [c.id, { x: c.position.x, y: c.position.y, w: c.position.width, h: c.position.height }]),
  );
  const known = diagram.relations.filter((r) => boxes.has(r.source) && boxes.has(r.target));
  const routes = routeEdges({ boxes, edges: known, orthogonal });
  const byRelation = new Map(known.map((r, i) => [r, routes[i]]));
  return diagram.relations.map((r) => byRelation.get(r) ?? []);
}
