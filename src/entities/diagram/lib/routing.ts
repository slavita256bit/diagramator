/**
 * Edge router: computes a polyline for every relation that does not cross class boxes.
 * Result is stored in `Relation.route`, drawn by `FloatingEdge` and by the Typst exporter,
 * so both renderings share one geometry.
 *
 * - straight mode: direct line if clear, else shortest path over box corners (visibility graph);
 * - orthogonal mode: A* over a sparse grid built from box borders, penalising bends.
 *
 * Pure module (no imports at runtime) so `routing.test.ts` runs under plain Node.
 */

import type { AnchorSide, EdgeAnchor, RelationAnchors } from "@/shared/types";

export interface RoutingOptions {
  edgeMergeTargets?: boolean;
  edgeClearance?: number;
  edgePortSpacing?: number;
  edgeBendPenalty?: number;
  edgeSourceSide?: AnchorSide;
  edgeTargetSide?: AnchorSide;
}

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RouteInput {
  boxes: Map<string, Rect>;
  edges: { source: string; target: string; type?: string; anchors?: RelationAnchors }[];
  options?: RoutingOptions;
  orthogonal: boolean;
}

/** Clearance kept between edges and boxes. */
const MARGIN = 12;
/** Self-relation loop size, same as `LOOP` in `typst.rs`. */
const LOOP = 36;
/** Extra cost of one 90° turn, in px of path length. */
const BEND = 24;
/** Orthogonal mode: cost multiplier for running along a segment another edge already uses. */
const SHARED = 3;
const EPS = 0.01;

const inflate = (r: Rect, m: number): Rect => ({ x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m });
const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const strictlyInside = (p: Pt, r: Rect) =>
  p.x > r.x + EPS && p.x < r.x + r.w - EPS && p.y > r.y + EPS && p.y < r.y + r.h - EPS;

/** Point where the ray from `r`'s center towards `to` leaves `r`. */
export function borderPoint(r: Rect, to: Pt): Pt {
  const c = center(r);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const t = Math.min(dx === 0 ? Infinity : r.w / 2 / Math.abs(dx), dy === 0 ? Infinity : r.h / 2 / Math.abs(dy));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/** Does segment a–b pass through the interior of `r`? (Liang–Barsky clip.) */
export function segmentHitsRect(a: Pt, b: Pt, r: Rect): boolean {
  const l = r.x + EPS, rt = r.x + r.w - EPS, t = r.y + EPS, bt = r.y + r.h - EPS;
  if (l >= rt || t >= bt) return false;
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (p === 0) return q > 0;
    const u = q / p;
    if (p < 0) {
      if (u > t1) return false;
      if (u > t0) t0 = u;
    } else {
      if (u < t0) return false;
      if (u < t1) t1 = u;
    }
    return true;
  };
  return clip(-dx, a.x - l) && clip(dx, rt - a.x) && clip(-dy, a.y - t) && clip(dy, bt - a.y) && t0 < t1;
}

/** Same loop as the editor always drew: out of the right side, into the top. */
export function selfLoop(r: Rect): Pt[] {
  const right = r.x + r.w;
  const startY = r.y + Math.min(24, r.h / 3);
  const endX = right - Math.min(40, r.w / 4);
  return [
    { x: right, y: startY },
    { x: right + LOOP, y: startY },
    { x: right + LOOP, y: r.y - LOOP },
    { x: endX, y: r.y - LOOP },
    { x: endX, y: r.y },
  ];
}

export function straightLine(s: Rect, t: Rect): Pt[] {
  return [borderPoint(s, center(t)), borderPoint(t, center(s))];
}

/** Drop points lying on the straight line between their neighbours. */
function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && Math.abs(out[out.length - 1].x - p.x) < EPS && Math.abs(out[out.length - 1].y - p.y) < EPS) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2], b = out[out.length - 1];
      if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < EPS
        && (b.x - a.x) * (p.x - b.x) + (b.y - a.y) * (p.y - b.y) >= 0) out.pop();
    }
    out.push(p);
  }
  return out;
}

/** Tiny binary min-heap of (priority, value). */
class Heap {
  private p: number[] = [];
  private v: number[] = [];
  get size() {
    return this.p.length;
  }
  push(prio: number, val: number) {
    const { p, v } = this;
    let i = p.length;
    p.push(prio);
    v.push(val);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (p[up] <= prio) break;
      p[i] = p[up];
      v[i] = v[up];
      i = up;
    }
    p[i] = prio;
    v[i] = val;
  }
  /** Returns [priority, value]. */
  pop(): [number, number] {
    const { p, v } = this;
    const top: [number, number] = [p[0], v[0]];
    const lp = p.pop()!, lv = v.pop()!;
    if (p.length) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= p.length) break;
        if (c + 1 < p.length && p[c + 1] < p[c]) c++;
        if (p[c] >= lp) break;
        p[i] = p[c];
        v[i] = v[c];
        i = c;
      }
      p[i] = lp;
      v[i] = lv;
    }
    return top;
  }
}

// ---------------------------------------------------------------- straight mode

function routeStraight(input: RouteInput): Pt[][] {
  const rects = [...input.boxes.values()];
  const obstacles = rects.map((r) => inflate(r, MARGIN - 1));
  // Corners sit MARGIN outside their box, i.e. 1px outside the obstacle rects.
  const corners: Pt[] = rects
    .flatMap((r) => {
      const o = inflate(r, MARGIN);
      return [
        { x: o.x, y: o.y },
        { x: o.x + o.w, y: o.y },
        { x: o.x, y: o.y + o.h },
        { x: o.x + o.w, y: o.y + o.h },
      ];
    })
    .filter((p) => !obstacles.some((o) => strictlyInside(p, o)));
  const clear = (a: Pt, b: Pt, skip: (Rect | null)[]) =>
    obstacles.every((o, i) => skip.includes(rects[i]) || !segmentHitsRect(a, b, o));
  // Corner-to-corner visibility is shared by all edges.
  const cache = new Map<number, boolean>();
  const cornerClear = (i: number, j: number) => {
    const key = i < j ? i * corners.length + j : j * corners.length + i;
    let v = cache.get(key);
    if (v === undefined) cache.set(key, (v = clear(corners[i], corners[j], [])));
    return v;
  };

  return input.edges.map(({ source, target }) => {
    const s = input.boxes.get(source)!, t = input.boxes.get(target)!;
    if (s === t) return selfLoop(s);
    const direct = straightLine(s, t);
    if (clear(direct[0], direct[1], [s, t])) return direct;

    // Dijkstra: node n = corner index, n = C → source center, n = C+1 → target center.
    const C = corners.length;
    const pt = (n: number) => (n < C ? corners[n] : center(n === C ? s : t));
    // Segments from a center may cross their own box.
    const visible = (a: number, b: number) =>
      a < C && b < C
        ? cornerClear(a, b)
        : clear(pt(a), pt(b), [a === C || b === C ? s : null, a === C + 1 || b === C + 1 ? t : null]);
    const dist = new Float64Array(C + 2).fill(Infinity);
    const prev = new Int32Array(C + 2).fill(-1);
    const done = new Uint8Array(C + 2);
    const heap = new Heap();
    dist[C] = 0;
    heap.push(0, C);
    while (heap.size) {
      const [d, u] = heap.pop();
      if (done[u]) continue;
      done[u] = 1;
      if (u === C + 1) break;
      for (let v = 0; v < C + 2; v++) {
        if (done[v] || v === C) continue;
        const a = pt(u), b = pt(v);
        const nd = d + Math.hypot(b.x - a.x, b.y - a.y);
        if (nd < dist[v] && visible(u, v)) {
          dist[v] = nd;
          prev[v] = u;
          heap.push(nd, v);
        }
      }
    }
    if (prev[C + 1] < 0) return direct;
    const path: Pt[] = [];
    for (let n = C + 1; n >= 0; n = prev[n]) path.unshift(pt(n));
    // Clip the center-to-corner ends at the box borders.
    path[0] = borderPoint(s, path[1]);
    path[path.length - 1] = borderPoint(t, path[path.length - 2]);
    return path;
  });
}

// -------------------------------------------------------------- orthogonal mode

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];
const OPPOSITE = [1, 0, 3, 2];

/** Find a position on the closest side, stored relative to the box for resizing. */
export function nearestAnchor(p: Pt, r: Rect): EdgeAnchor {
  const x = Math.max(r.x, Math.min(r.x + r.w, p.x));
  const y = Math.max(r.y, Math.min(r.y + r.h, p.y));
  const candidates: [AnchorSide, number][] = [
    ["top", Math.hypot(p.x - x, p.y - r.y)], ["bottom", Math.hypot(p.x - x, p.y - r.y - r.h)],
    ["left", Math.hypot(p.x - r.x, p.y - y)], ["right", Math.hypot(p.x - r.x - r.w, p.y - y)],
  ];
  candidates.sort((a, b) => a[1] - b[1]);
  const side = candidates[0][0];
  const horizontal = side === "top" || side === "bottom";
  const offset = horizontal ? (p.x - r.x) / r.w : (p.y - r.y) / r.h;
  return { side, offset: Math.max(0.03, Math.min(0.97, offset)) };
}

/** A small magnetic zone in screen pixels; Shift locks to the closest quarter point. */
export function snapAnchor(anchor: EdgeAnchor, r: Rect, zoom: number, force = false): EdgeAnchor {
  const stops = [0.25, 0.5, 0.75];
  const stop = stops.reduce((best, value) =>
    Math.abs(value - anchor.offset) < Math.abs(best - anchor.offset) ? value : best);
  const length = anchor.side === "top" || anchor.side === "bottom" ? r.w : r.h;
  // Cap the zone on small boxes so moving freely between stops stays easy.
  const radius = Math.min(6 / Math.max(zoom, 0.05), length * 0.04);
  return force || Math.abs(stop - anchor.offset) * length <= radius
    ? { ...anchor, offset: stop } : anchor;
}

export function anchorPort(r: Rect, anchor: EdgeAnchor, clearance: number) {
  const offset = Number.isFinite(anchor.offset) ? Math.max(0, Math.min(1, anchor.offset)) : 0.5;
  const horizontal = anchor.side === "top" || anchor.side === "bottom";
  const x = horizontal ? r.x + offset * r.w : anchor.side === "left" ? r.x : r.x + r.w;
  const y = horizontal ? anchor.side === "top" ? r.y : r.y + r.h : r.y + offset * r.h;
  const dir = { right: 0, left: 1, bottom: 2, top: 3 }[anchor.side];
  return { port: { x, y }, stub: { x: x + DX[dir] * clearance, y: y + DY[dir] * clearance }, dir };
}

/** Order ports along each side. Compatible incoming arrows may share one port. */
function connectionPorts(input: RouteInput, sourceSide: boolean, clearance: number) {
  const groups = new Map<string, number[]>();
  const result: ReturnType<typeof anchorPort>[] = [];
  const side = (sourceSide ? input.options?.edgeSourceSide : input.options?.edgeTargetSide) ?? (sourceSide ? "top" : "bottom");
  input.edges.forEach((edge, i) => {
    const id = sourceSide ? edge.source : edge.target;
    const manual = sourceSide ? edge.anchors?.source : edge.anchors?.target;
    if (manual) { result[i] = anchorPort(input.boxes.get(id)!, manual, clearance); return; }
    const group = groups.get(id) ?? [];
    group.push(i);
    groups.set(id, group);
  });
  for (const [id, group] of groups) {
    const r = input.boxes.get(id)!;
    const horizontal = side === "top" || side === "bottom";
    const other = (i: number) => center(input.boxes.get(sourceSide ? input.edges[i].target : input.edges[i].source)!);
    group.sort((a, b) => (horizontal ? other(a).x - other(b).x : other(a).y - other(b).y) || a - b);
    const bundles: number[][] = [];
    for (const edge of group) {
      const existing = !sourceSide && (input.options?.edgeMergeTargets ?? true)
        ? bundles.find((g) => input.edges[g[0]].type === input.edges[edge].type) : undefined;
      if (existing) existing.push(edge); else bundles.push([edge]);
    }
    const length = horizontal ? r.w : r.h;
    const span = Math.min(Math.max(0, length - 2 * MARGIN), (bundles.length - 1) * (input.options?.edgePortSpacing ?? 20));
    bundles.forEach((bundle, rank) => {
      const offset = 0.5 + (bundles.length > 1 ? span * (rank / (bundles.length - 1) - 0.5) / length : 0);
      for (const edge of bundle) result[edge] = anchorPort(r, { side, offset }, clearance);
    });
  }
  return result;
}

function routeOrthogonal(input: RouteInput): Pt[][] {
  const rects = [...input.boxes.values()];
  const clearance = Math.max(1, input.options?.edgeClearance ?? MARGIN);
  const bend = Math.max(0, input.options?.edgeBendPenalty ?? BEND);
  const merge = input.options?.edgeMergeTargets ?? true;
  const obstacles = rects.map((r) => inflate(r, clearance));
  const sourcePorts = connectionPorts(input, true, clearance);
  const targetPorts = connectionPorts(input, false, clearance);
  const allPorts = [...sourcePorts, ...targetPorts];
  // Include gap midpoints for balanced elbows between neighbouring layers.
  const uniq = (a: number[]) => [...new Set(a)].sort((p, q) => p - q);
  const withMidpoints = (values: number[]) => {
    const sorted = uniq(values);
    return uniq([...sorted, ...sorted.slice(1).map((v, i) => (v + sorted[i]) / 2)]);
  };
  const xs = withMidpoints([...obstacles.flatMap((o) => [o.x, o.x + o.w]), ...allPorts.map((p) => p.stub.x)]);
  const ys = withMidpoints([...obstacles.flatMap((o) => [o.y, o.y + o.h]), ...allPorts.map((p) => p.stub.y)]);
  const nx = xs.length, ny = ys.length;
  const idx = (i: number, j: number) => j * nx + i;
  const blockedAt = (p: Pt) => obstacles.some((o) => strictlyInside(p, o));
  // ponytail: O(grid × boxes) precompute, fine for ~100 classes; use a sweep if it gets slow.
  const free = new Uint8Array(nx * ny);
  const hOpen = new Uint8Array(nx * ny); // (i,j) → (i+1,j)
  const vOpen = new Uint8Array(nx * ny); // (i,j) → (i,j+1)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      free[idx(i, j)] = blockedAt({ x: xs[i], y: ys[j] }) ? 0 : 1;
      if (i + 1 < nx) hOpen[idx(i, j)] = blockedAt({ x: (xs[i] + xs[i + 1]) / 2, y: ys[j] }) ? 0 : 1;
      if (j + 1 < ny) vOpen[idx(i, j)] = blockedAt({ x: xs[i], y: (ys[j] + ys[j + 1]) / 2 }) ? 0 : 1;
    }
  const find = (a: number[], v: number) => a.indexOf(v);
  // Grid segments taken by earlier edges (same indexing as hOpen/vOpen), to spread edges apart.
  const hUsed = new Map<number, Set<string>>();
  const vUsed = new Map<number, Set<string>>();
  return input.edges.map((edge, edgeIndex) => {
    // Share only compatible arrowheads going to the same attachment point.
    const endpoint = targetPorts[edgeIndex].port;
    const bundle = `${edge.target}:${edge.type ?? ""}:${endpoint.x}:${endpoint.y}`;
    const onGrid = (p: typeof sourcePorts[number]) => ({ ...p, n: idx(find(xs, p.stub.x), find(ys, p.stub.y)) });
    const starts = [onGrid(sourcePorts[edgeIndex])];
    const goals = [onGrid(targetPorts[edgeIndex])];
    const middleY = (starts[0].stub.y + goals[0].stub.y) / 2;
    const goalOf = new Map(goals.filter((g) => free[g.n]).map((g) => [g.n, g]));
    const h = (n: number) => {
      const x = xs[n % nx], y = ys[Math.floor(n / nx)];
      return Math.min(...goals.map((g) => Math.abs(g.stub.x - x) + Math.abs(g.stub.y - y))) * (merge ? 0.65 : 1);
    };

    // State = node * 4 + direction of travel.
    const g = new Float64Array(nx * ny * 4).fill(Infinity);
    const prev = new Int32Array(nx * ny * 4).fill(-1);
    const heap = new Heap();
    for (const st of starts) {
      if (!free[st.n]) continue;
      const k = st.n * 4 + st.dir;
      g[k] = clearance;
      heap.push(g[k] + h(st.n), k);
    }
    let best = Infinity, bestState = -1;
    while (heap.size) {
      const [f, k] = heap.pop();
      if (f >= best) break;
      const n = k >> 2, d = k & 3, cost = g[k];
      if (f > cost + h(n) + EPS) continue; // stale entry
      const goal = goalOf.get(n);
      if (goal && d !== goal.dir) {
        // Final hop goes into the box, against the goal's outward direction.
        const total =
          cost + clearance + (d === OPPOSITE[goal.dir] ? 0 : bend);
        if (total < best) {
          best = total;
          bestState = k;
        }
      }
      const i = n % nx, j = Math.floor(n / nx);
      for (let nd = 0; nd < 4; nd++) {
        if (nd === OPPOSITE[d]) continue;
        const ni = i + DX[nd], nj = j + DY[nd];
        if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
        const seg = nd === 0 ? idx(i, j) : nd === 1 ? idx(ni, nj) : nd === 2 ? idx(i, j) : idx(ni, nj);
        const horizontal = nd < 2;
        const m = idx(ni, nj);
        if (!(horizontal ? hOpen : vOpen)[seg] || !free[m]) continue;
        const nk = m * 4 + nd;
        const len = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
        const used = (horizontal ? hUsed : vUsed).get(seg);
        const shared = used ? merge && used.has(bundle) ? 0.65 : SHARED : 1;
        // Break equal-length ties in favour of an elbow midway between the blocks.
        const balance = horizontal ? len * Math.abs(ys[j] - middleY) * 0.001 : 0;
        const ng = cost + len * shared + (nd === d ? 0 : bend) + balance;
        if (ng < g[nk]) {
          g[nk] = ng;
          prev[nk] = k;
          heap.push(ng + h(m), nk);
        }
      }
    }
    if (bestState < 0) {
      // Overlapping boxes can block the mandatory ports. Keep right-angle geometry
      // and the requested endpoint directions even when clearance is impossible.
      const start = sourcePorts[edgeIndex], goal = targetPorts[edgeIndex];
      const outside = Math.max(...rects.map((r) => r.x + r.w)) + 2 * MARGIN;
      return simplify([start.port, start.stub, { x: outside, y: start.stub.y },
        { x: outside, y: goal.stub.y }, goal.stub, goal.port]);
    }

    const nodes: Pt[] = [];
    let k = bestState;
    for (; prev[k] >= 0; k = prev[k]) {
      nodes.unshift({ x: xs[(k >> 2) % nx], y: ys[Math.floor((k >> 2) / nx)] });
      const a = k >> 2, b = prev[k] >> 2; // one grid step
      const used = Math.abs(a - b) === 1 ? hUsed : vUsed;
      const segment = Math.min(a, b);
      const bundles = used.get(segment) ?? new Set<string>();
      bundles.add(bundle);
      used.set(segment, bundles);
    }
    nodes.unshift({ x: xs[(k >> 2) % nx], y: ys[Math.floor((k >> 2) / nx)] });
    const start = starts.find((st) => st.n === k >> 2 && st.dir === (k & 3))!;
    const goal = goalOf.get(bestState >> 2)!;
    return simplify([start.port, ...nodes, goal.port]);
  });
}

/** Routes for `edges`, in order. Unknown box ids must be filtered out by the caller. */
export function routeEdges(input: RouteInput): Pt[][] {
  return input.orthogonal ? routeOrthogonal(input) : routeStraight(input);
}
