import type { Flowchart, FlowchartJunction, FlowchartLabel, FlowchartNode, FlowchartPoint, FlowchartRoute, FlowchartRoutePoint } from "@/shared/types";

export const PORT_SIDES = ["top", "right", "bottom", "left"] as const;
export type Port = Extract<FlowchartRoutePoint, { node: string }>;

export function labelAnchor(label: FlowchartLabel, nodes: FlowchartNode[], geometry?: ReadonlyMap<string, FlowchartPoint[]>): FlowchartPoint {
  const anchor = label.anchor;
  if (!anchor) return { x: 0, y: 0 };
  const points = anchor.route ? geometry?.get(anchor.route) : undefined;
  if (points && points.length > 1 && anchor.along !== undefined) {
    const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
    let remaining = lengths.reduce((total, length) => total + length, 0) * anchor.along;
    for (let i = 0; i < lengths.length; i++) {
      const length = lengths[i];
      if (length && remaining <= length) {
        const a = points[i], b = points[i + 1], ratio = remaining / length;
        return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      }
      remaining -= length;
    }
    return points.at(-1)!;
  }
  return "node" in anchor ? resolvePoint(anchor, nodes) : points?.[0] ?? { x: 0, y: 0 };
}

export function labelPosition(label: FlowchartLabel, nodes: FlowchartNode[], geometry?: ReadonlyMap<string, FlowchartPoint[]>): FlowchartPoint {
  if (!label.anchor) return label.position;
  const port = labelAnchor(label, nodes, geometry);
  return { x: port.x + label.position.x, y: port.y + label.position.y };
}

export function routeFraction(points: readonly FlowchartPoint[], point: FlowchartPoint): number {
  const segment = nearestSegment(points, point);
  if (segment < 0) return 0;
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (!total) return 0;
  const a = points[segment], b = points[segment + 1];
  const distance = a.x === b.x ? (point.y - a.y) * Math.sign(b.y - a.y) : (point.x - a.x) * Math.sign(b.x - a.x);
  return (lengths.slice(0, segment).reduce((sum, value) => sum + value, 0) +
    Math.min(lengths[segment], Math.max(0, distance))) / total;
}

export function connectPorts(chart: Flowchart, from: Port, to: Port, id: string): FlowchartRoute {
  const a = resolvePoint(from, chart.nodes), b = resolvePoint(to, chart.nodes);
  if (a.x === b.x && a.y === b.y) throw new Error("Move the blocks apart before connecting these ports.");
  return { id, points: [from, to], arrow: true, automatic: true };
}

export function dimensions(node: FlowchartNode) {
  return { width: node.kind === "connector" ? 10 : 40,
    height: node.kind === "connector" || node.kind === "terminal" ? 10 : 20 };
}

export function resolvePoint(point: FlowchartRoutePoint, nodes: FlowchartNode[], junctions: readonly FlowchartJunction[] = []): FlowchartPoint {
  if ("junction" in point) {
    const junction = junctions.find((item) => item.id === point.junction);
    if (!junction) throw new Error(`Unknown junction: ${point.junction}`);
    if (!junction.anchor) return junction.position;
    const port = resolvePoint(junction.anchor, nodes);
    return { x: port.x + junction.position.x, y: port.y + junction.position.y };
  }
  if (!("node" in point)) {
    const axis = (key: "x" | "y", id?: string) => point[key] + (nodes.find((node) => node.id === id)?.position[key] ?? 0);
    return { x: axis("x", point.alignX), y: axis("y", point.alignY) };
  }
  const node = nodes.find((item) => item.id === point.node);
  if (!node) throw new Error(`Unknown block: ${point.node}`);
  const { width, height } = dimensions(node);
  const horizontal = node.kind === "input-output" ? width / 2 - height / 4 : width / 2;
  return { x: node.position.x + (point.side === "left" ? -horizontal : point.side === "right" ? horizontal : 0),
    y: node.position.y + (point.side === "top" ? -height / 2 : point.side === "bottom" ? height / 2 : 0) };
}

/** Create an orthogonal route between two blocks without duplicate points. */
export function connectBlocks(source: FlowchartNode, target: FlowchartNode, id: string) {
  const from = { node: source.id, side: "bottom" as const };
  const to = { node: target.id, side: "top" as const };
  const a = resolvePoint(from, [source, target]);
  const b = resolvePoint(to, [source, target]);
  if (a.x === b.x && a.y === b.y) throw new Error("Move the blocks apart before connecting them.");
  if (a.x === b.x && a.y !== b.y) return { id, points: [from, to], arrow: true };
  const middle = a.y === b.y ? a.y + 5 : (a.y + b.y) / 2;
  return { id, points: [from, { x: a.x, y: middle }, { x: b.x, y: middle }, to], arrow: true };
}

/** Resolve user-owned points without saving generated elbows into the document. */
export function routeGeometry(route: FlowchartRoute, nodes: FlowchartNode[], junctions?: readonly FlowchartJunction[]): FlowchartPoint[] {
  const result: FlowchartPoint[] = [];
  const append = (point: FlowchartPoint) => {
    const last = result.at(-1);
    if (!last || last.x !== point.x || last.y !== point.y) result.push(point);
  };
  append(resolvePoint(route.points[0], nodes, junctions));
  for (let i = 1; i < route.points.length; i++) {
    const previous = route.points[i - 1];
    const next = route.points[i];
    const a = resolvePoint(previous, nodes, junctions);
    const b = resolvePoint(next, nodes, junctions);
    if (a.x !== b.x && a.y !== b.y) {
      if ("node" in previous && "node" in next) {
        const fromVertical = previous.side === "top" || previous.side === "bottom";
        const toVertical = next.side === "top" || next.side === "bottom";
        if (fromVertical && toVertical) {
          const middle = (a.y + b.y) / 2;
          append({ x: a.x, y: middle });
          append({ x: b.x, y: middle });
          append(b);
          continue;
        }
        if (!fromVertical && !toVertical) {
          const middle = (a.x + b.x) / 2;
          append({ x: middle, y: a.y });
          append({ x: middle, y: b.y });
          append(b);
          continue;
        }
      }
      const vertical = "node" in previous ? previous.side === "top" || previous.side === "bottom"
        : "node" in next ? next.side === "left" || next.side === "right" : true;
      append(vertical ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
    }
    append(b);
  }
  return result;
}

export function moveBlock(chart: Flowchart, id: string, position: FlowchartPoint): Flowchart {
  return { ...chart, nodes: chart.nodes.map((node) => node.id === id ? { ...node, position } : node) };
}

export function snapBlock(nodes: FlowchartNode[], moving: FlowchartNode, position: FlowchartPoint, tolerance: number) {
  const size = dimensions(moving);
  const guides: Partial<FlowchartPoint> = {};
  const point = { ...position };
  for (const axis of ["x", "y"] as const) {
    const cross = axis === "x" ? "y" : "x";
    const dimension = axis === "x" ? "width" : "height";
    let nearest = tolerance;
    const candidates = nodes.filter((node) => node.id !== moving.id)
      .sort((a, b) => Math.abs(a.position[cross] - position[cross]) - Math.abs(b.position[cross] - position[cross]));
    for (const node of candidates) {
      for (const edge of [0, -1, 1]) {
        const target = node.position[axis] + edge * dimensions(node)[dimension] / 2;
        const value = target - edge * size[dimension] / 2;
        const delta = Math.abs(position[axis] - value);
        if (delta < nearest) { nearest = delta; point[axis] = value; guides[axis] = target; }
      }
    }
  }
  return { point, guides };
}

export function simplifyRoute(points: FlowchartPoint[], junctions: FlowchartPoint[] = []): FlowchartPoint[] {
  const result: FlowchartPoint[] = [];
  for (const point of points) {
    while (result.length >= 2) {
      const a = result.at(-2)!, b = result.at(-1)!;
      if (!((a.x === b.x && b.x === point.x) || (a.y === b.y && b.y === point.y))) break;
      if (junctions.some((junction) => junction.x === b.x && junction.y === b.y)) break;
      result.pop();
    }
    const last = result.at(-1);
    if (!last || last.x !== point.x || last.y !== point.y) result.push(point);
  }
  return result;
}

export function shiftSegment(chart: Flowchart, route: FlowchartRoute, points: FlowchartPoint[], index: number, position: FlowchartPoint): FlowchartRoute {
  const a = points[index], b = points[index + 1];
  const axis = a.y === b.y ? "y" : "x";
  const along = axis === "x" ? "y" : "x";
  const refs = route.points.filter((point) => "node" in point || "junction" in point || point.alignX || point.alignY)
    .map((point) => ({ point, resolved: resolvePoint(point, chart.nodes, chart.junctions) }));
  const preserveReference = (point: FlowchartPoint) =>
    refs.find(({ resolved }) => resolved.x === point.x && resolved.y === point.y)?.point ?? point;
  const isJunctionOrPort = (point: FlowchartPoint) => {
    const ref = preserveReference(point);
    return "junction" in ref || "node" in ref;
  };
  // The neighboring legs already meet the translated segment at right angles.
  // Keep the old corner only when it represents a fixed port or shared junction.
  const before = points.slice(1, index + (isJunctionOrPort(a) ? 1 : 0)).map(preserveReference);
  const after = points.slice(index + (isJunctionOrPort(b) ? 1 : 2), -1).map(preserveReference);
  const portStub = (end: FlowchartPoint, toward: FlowchartPoint) => {
    const port = preserveReference(end);
    if (!("node" in port)) return end;
    const direction = port.side === "top" || port.side === "left" ? -1 : 1;
    const portAxis = port.side === "top" || port.side === "bottom" ? "y" : "x";
    const distance = (toward[along] - end[along]) * direction;
    // Leave the port along its normal before turning to the shifted segment.
    return along === portAxis && distance > 0 ? { ...end, [along]: end[along] + direction * Math.min(2, distance / 3) } : end;
  };
  const start = portStub(a, b), end = portStub(b, a);
  return {
    ...route, automatic: false,
    points: [route.points[0], ...before, ...(start === a ? [] : [start]), { ...start, [axis]: position[axis] },
      { ...end, [axis]: position[axis] }, ...(end === b ? [] : [end]), ...after, route.points.at(-1)!],
  };
}

/** Convert screen coordinates with either a WebKit SVGMatrix or a DOMMatrix. */
export function canvasPoint(matrix: Pick<DOMMatrix, "a" | "b" | "c" | "d" | "e" | "f"> | null | undefined, screen: FlowchartPoint): FlowchartPoint | null {
  if (!matrix) return null;
  const { a, b, c, d, e, f } = matrix;
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const dx = screen.x - e, dy = screen.y - f;
  const x = (d * dx - c * dy) / determinant;
  const y = (a * dy - b * dx) / determinant;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function nearestSegment(points: readonly FlowchartPoint[], point: FlowchartPoint): number {
  let closest = -1, distance = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    const x = Math.max(Math.min(a.x, b.x), Math.min(Math.max(a.x, b.x), point.x));
    const y = Math.max(Math.min(a.y, b.y), Math.min(Math.max(a.y, b.y), point.y));
    const next = Math.hypot(point.x - x, point.y - y);
    if (next < distance) { closest = i; distance = next; }
  }
  return closest;
}

type Bounds = { x: number; y: number; w: number; h: number };

export function blockBounds(node: FlowchartNode): Bounds {
  const { width, height } = dimensions(node);
  return { x: node.position.x - width / 2, y: node.position.y - height / 2, w: width, h: height };
}

export function commentBounds(comment: Flowchart["comments"][number], chart: Flowchart): Bounds {
  const port = resolvePoint({ node: comment.node, side: comment.side }, chart.nodes);
  const x = comment.side === "right" ? port.x + comment.gap : port.x - comment.gap - comment.width;
  return { x, y: port.y - comment.height / 2, w: comment.width, h: comment.height };
}

/** Prefer visible free space, then any space on the page, then a new row. */
export function placeNewBlock(chart: Flowchart, kind: FlowchartNode["kind"], id: string, viewport?: Bounds,
  geometry?: ReadonlyMap<string, FlowchartPoint[]>): Flowchart | null {
  const node: FlowchartNode = { id, kind, text: "", position: { x: 0, y: 0 } };
  const { width, height } = dimensions(node);
  const gap = 4;
  const obstacles = [
    ...chart.nodes.map(blockBounds),
    ...chart.comments.map((comment) => commentBounds(comment, chart)),
    ...chart.labels.map((label) => {
      const { x, y } = labelPosition(label, chart.nodes, geometry);
      return { x: x - label.width / 2, y, w: label.width, h: chart.canvas.textSize * 0.45 * label.text.split("\n").length };
    }),
  ];
  const size = { ...chart.canvas, width: Math.max(chart.canvas.width, width + 2 * gap) };
  const page = { x: 0, y: 0, w: size.width, h: size.height };

  const find = (area: Bounds) => {
    const minX = area.x + width / 2 + gap, maxX = area.x + area.w - width / 2 - gap;
    const minY = area.y + height / 2 + gap, maxY = area.y + area.h - height / 2 - gap;
    const center = { x: area.x + area.w / 2, y: area.y + area.h / 2 };
    const xs = new Set([center.x, minX, maxX]), ys = new Set([center.y, minY, maxY]);
    for (const box of obstacles) {
      xs.add(box.x - width / 2 - gap);
      xs.add(box.x + box.w + width / 2 + gap);
      ys.add(box.y - height / 2 - gap);
      ys.add(box.y + box.h + height / 2 + gap);
    }
    let position: FlowchartPoint | undefined, best = Infinity;
    for (const x of xs) {
      if (x < minX || x > maxX) continue;
      for (const y of ys) {
        if (y < minY || y > maxY) continue;
        const distance = Math.hypot(x - center.x, y - center.y);
        if (distance >= best || obstacles.some((box) =>
          x + width / 2 + gap > box.x && x - width / 2 - gap < box.x + box.w &&
          y + height / 2 + gap > box.y && y - height / 2 - gap < box.y + box.h)) continue;
        position = { x, y };
        best = distance;
      }
    }
    return position;
  };

  let position = (viewport && find(viewport)) || find(page);
  if (!position) {
    const bottom = obstacles.reduce((current, box) => Math.max(current, box.y + box.h), size.height);
    size.height = bottom + height + 2 * gap;
    if (size.height > 2000) return null;
    position = { x: size.width / 2, y: bottom + gap + height / 2 };
  }
  return { ...chart, canvas: size, nodes: [...chart.nodes, { ...node, position }] };
}

/** Reject malformed or unsupported files before they can replace the current document. */
export function parseFlowchart(text: string): Flowchart {
  const chart = JSON.parse(text) as Flowchart;
  const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n);
  const point = (p: FlowchartPoint | undefined) => p && finite(p.x) && finite(p.y);
  const kinds = ["terminal", "process", "predefined", "decision", "input-output", "loop-start", "loop-end", "connector"];
  if (!chart || chart.version !== 1 || !chart.canvas || !finite(chart.canvas.width) || chart.canvas.width <= 0 || chart.canvas.width > 2000 ||
    !finite(chart.canvas.height) || chart.canvas.height <= 0 || chart.canvas.height > 2000 || !finite(chart.canvas.textSize) || chart.canvas.textSize <= 0 ||
    !Array.isArray(chart.nodes) || !Array.isArray(chart.routes) || !Array.isArray(chart.labels) || !Array.isArray(chart.comments)) {
    throw new Error("This is not a supported flowchart JSON file.");
  }
  const ids = new Set<string>();
  const addId = (id: unknown) => {
    if (typeof id !== "string" || !id || ids.has(id)) throw new Error("Items must have unique, nonempty IDs.");
    ids.add(id);
  };
  for (const node of chart.nodes) {
    if (!node || !kinds.includes(node.kind) || !point(node.position) || typeof node.text !== "string") throw new Error("Invalid block.");
    if (node.emphasis && (typeof node.emphasis.text !== "string" || !node.emphasis.text || !finite(node.emphasis.size) || node.emphasis.size <= 0)) throw new Error("Invalid inline text size.");
    if (node.textSize !== undefined && (!finite(node.textSize) || node.textSize <= 0 || node.textSize > 72)) throw new Error("Invalid block text size.");
    addId(node.id);
  }
  const nodeIds = new Set(chart.nodes.map((node) => node.id));
  if (chart.junctions !== undefined && !Array.isArray(chart.junctions)) throw new Error("Invalid junction list.");
  for (const junction of chart.junctions ?? []) {
    if (!junction || !point(junction.position) || (junction.anchor &&
      (!nodeIds.has(junction.anchor.node) || !PORT_SIDES.includes(junction.anchor.side)))) throw new Error("Invalid junction.");
    addId(junction.id);
  }
  const junctionIds = new Set(chart.junctions?.map((junction) => junction.id));
  for (const route of chart.routes) {
    if (!route || !Array.isArray(route.points) || route.points.length < 2 || typeof route.arrow !== "boolean") throw new Error("Invalid route.");
    addId(route.id);
    for (const p of route.points) {
      if (!p || typeof p !== "object") throw new Error(`Invalid point in route ${route.id}.`);
      const valid = "junction" in p ? junctionIds.has(p.junction)
        : "node" in p ? nodeIds.has(p.node) && PORT_SIDES.includes(p.side) : point(p) &&
          (p.alignX === undefined || nodeIds.has(p.alignX)) && (p.alignY === undefined || nodeIds.has(p.alignY));
      if (!valid) throw new Error(`Invalid point in route ${route.id}.`);
    }
  }
  for (const label of chart.labels) {
    if (!label || !point(label.position) || !finite(label.width) || label.width <= 0 || typeof label.text !== "string") throw new Error("Invalid label.");
    if (label.anchor !== undefined) {
      const anchor = label.anchor;
      if (!anchor || typeof anchor !== "object" ||
        ("node" in anchor && (!nodeIds.has(anchor.node) || !PORT_SIDES.includes(anchor.side))) ||
        (anchor.route !== undefined && !chart.routes.some((route) => route.id === anchor.route)) ||
        (!("node" in anchor) && (anchor.route === undefined || anchor.along === undefined))) throw new Error("Invalid label anchor.");
      if (anchor.along !== undefined && (anchor.route === undefined || !finite(anchor.along) ||
        anchor.along < 0 || anchor.along > 1)) throw new Error("Invalid connection label position.");
    }
    addId(label.id);
  }
  for (const comment of chart.comments) {
    if (!comment || !nodeIds.has(comment.node) || !["left", "right"].includes(comment.side) || !finite(comment.gap) || comment.gap <= 0 ||
      !finite(comment.width) || comment.width <= 6 || !finite(comment.height) || comment.height <= 0 || typeof comment.text !== "string") throw new Error("Invalid comment.");
    addId(comment.id);
  }
  return chart;
}
