import { routeEdges, segmentHitsRect, type Rect } from "@/entities/diagram";
import type { Flowchart, FlowchartPoint, FlowchartRoute } from "@/shared/types";
import { blockBounds, commentBounds, labelAnchor, labelPosition, resolvePoint, routeFraction, routeGeometry, simplifyRoute } from "./flowchart";

export function resolvedRoutes(chart: Flowchart): Map<string, FlowchartPoint[]> {
  const boxes = new Map<string, Rect>(chart.nodes.map((node) => [`block:${node.id}`, blockBounds(node)]));
  chart.comments.forEach((comment) => boxes.set(`comment:${comment.id}`, commentBounds(comment, chart)));
  const automatic = chart.routes.flatMap((route) => {
    const [first, last] = route.points;
    if (!route.automatic || route.points.length !== 2 || !("node" in first) || !("node" in last)) return [];
    const a = resolvePoint(first, chart.nodes), b = resolvePoint(last, chart.nodes);
    if (a.x === b.x && a.y === b.y) return [];
    return [{ route, first, last }];
  });
  const computed = automatic.length ? routeEdges({
    boxes, orthogonal: true,
    edges: automatic.map(({ first, last }) => ({
      source: `block:${first.node}`, target: `block:${last.node}`,
      anchors: { source: { side: first.side, offset: 0.5 }, target: { side: last.side, offset: 0.5 } },
    })),
    options: { edgeClearance: 2, edgeBendPenalty: 5, edgeMergeTargets: false },
  }) : [];
  const result = new Map(chart.routes.map((route) => {
    const points = routeGeometry(route, chart.nodes, chart.junctions);
    const junctions = route.points.filter((point) => "junction" in point)
      .map((point) => resolvePoint(point, chart.nodes, chart.junctions));
    return [route.id, simplifyRoute(points, junctions)];
  }));
  automatic.forEach(({ route, first, last }, index) => {
    const points = computed[index];
    if (points.length < 2) return;
    // The box router uses rectangular sides. Move its endpoints to the actual symbol ports.
    points[0] = resolvePoint(first, chart.nodes);
    points[points.length - 1] = resolvePoint(last, chart.nodes);
    result.set(route.id, simplifyRoute(points));
  });
  return result;
}

/** Upgrade older branch labels without moving them on the page when opening a document. */
export function attachLegacyBranchLabels(chart: Flowchart): Flowchart {
  if (!chart.labels.some((label) => label.anchor?.route && label.anchor.along === undefined)) return chart;
  const geometry = resolvedRoutes(chart);
  return { ...chart, labels: chart.labels.map((label) => {
    const route = label.anchor?.route;
    const points = route ? geometry.get(route) : undefined;
    if (!route || !label.anchor || label.anchor.along !== undefined || !points || points.length < 2) return label;
    const current = labelPosition(label, chart.nodes);
    const anchor = { route, along: routeFraction(points, current) };
    const origin = labelAnchor({ ...label, anchor }, chart.nodes, geometry);
    return { ...label, anchor, position: { x: current.x - origin.x, y: current.y - origin.y } };
  }) };
}

export function passesThroughObstacle(route: FlowchartRoute, points: FlowchartPoint[], chart: Flowchart): boolean {
  const attached = new Set(route.points.flatMap((point) => "node" in point ? [point.node] : []));
  const obstacles = [
    ...chart.nodes.filter((node) => !attached.has(node.id)).map(blockBounds),
    ...chart.comments.map((comment) => commentBounds(comment, chart)),
  ];
  return points.some((point, index) => index > 0 && obstacles.some((box) => segmentHitsRect(points[index - 1], point, box)));
}
