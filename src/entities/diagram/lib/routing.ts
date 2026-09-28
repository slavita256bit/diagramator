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
  edges: { source: string; target: string }[];
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
/** Orthogonal mode: cost of leaving/entering through a port another edge already starts from. */
const PORT_TAKEN = 120;
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
      if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < EPS) out.pop();
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

/** Side midpoints of `r` with outward direction (index into DX/DY). */
function ports(r: Rect): { port: Pt; stub: Pt; dir: number }[] {
  const c = center(r);
  return [
    { port: { x: r.x + r.w, y: c.y }, stub: { x: r.x + r.w + MARGIN, y: c.y }, dir: 0 },
    { port: { x: r.x, y: c.y }, stub: { x: r.x - MARGIN, y: c.y }, dir: 1 },
    { port: { x: c.x, y: r.y + r.h }, stub: { x: c.x, y: r.y + r.h + MARGIN }, dir: 2 },
    { port: { x: c.x, y: r.y }, stub: { x: c.x, y: r.y - MARGIN }, dir: 3 },
  ];
}

function routeOrthogonal(input: RouteInput): Pt[][] {
  const rects = [...input.boxes.values()];
  const obstacles = rects.map((r) => inflate(r, MARGIN));
  // Grid lines: inflated borders and centers of every box (covers every port and stub).
  const uniq = (a: number[]) => [...new Set(a.map((n) => Math.round(n * 100) / 100))].sort((p, q) => p - q);
  const xs = uniq(obstacles.flatMap((o) => [o.x, o.x + o.w, o.x + o.w / 2]));
  const ys = uniq(obstacles.flatMap((o) => [o.y, o.y + o.h, o.y + o.h / 2]));
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
  const find = (a: number[], v: number) => a.indexOf(Math.round(v * 100) / 100);
  // Grid segments taken by earlier edges (same indexing as hOpen/vOpen), to spread edges apart.
  const hUsed = new Uint8Array(nx * ny);
  const vUsed = new Uint8Array(nx * ny);
  // Ports used as edge starts: sharing them stacks diamonds/tails on each other.
  // Converging on a shared target port is fine (UML-style shared arrowhead).
  const startPorts = new Set<string>();
  const portKey = (p: Pt) => `${p.x},${p.y}`;

  return input.edges.map(({ source, target }) => {
    const s = input.boxes.get(source)!, t = input.boxes.get(target)!;
    if (s === t) return selfLoop(s);

    const starts = ports(s).map((p) => ({ ...p, n: idx(find(xs, p.stub.x), find(ys, p.stub.y)) }));
    const goals = ports(t).map((p) => ({ ...p, n: idx(find(xs, p.stub.x), find(ys, p.stub.y)) }));
    const goalOf = new Map(goals.filter((g) => free[g.n]).map((g) => [g.n, g]));
    const h = (n: number) => {
      const x = xs[n % nx], y = ys[Math.floor(n / nx)];
      return Math.min(...goals.map((g) => Math.abs(g.stub.x - x) + Math.abs(g.stub.y - y)));
    };

    // State = node * 4 + direction of travel.
    const g = new Float64Array(nx * ny * 4).fill(Infinity);
    const prev = new Int32Array(nx * ny * 4).fill(-1);
    const heap = new Heap();
    for (const st of starts) {
      if (!free[st.n]) continue;
      const k = st.n * 4 + st.dir;
      g[k] = MARGIN + (startPorts.has(portKey(st.port)) ? PORT_TAKEN : 0);
      heap.push(g[k] + h(st.n), k);
    }
    let best = Infinity, bestState = -1;
    while (heap.size) {
      const [f, k] = heap.pop();
      if (f >= best) break;
      const n = k >> 2, d = k & 3, cost = g[k];
      if (f > cost + h(n) + EPS) continue; // stale entry
      const goal = goalOf.get(n);
      if (goal) {
        // Final hop goes into the box, against the goal's outward direction.
        const total =
          cost + MARGIN + (d === OPPOSITE[goal.dir] ? 0 : BEND) + (startPorts.has(portKey(goal.port)) ? PORT_TAKEN : 0);
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
        const shared = (horizontal ? hUsed : vUsed)[seg] ? SHARED : 1;
        const ng = cost + len * shared + (nd === d ? 0 : BEND);
        if (ng < g[nk]) {
          g[nk] = ng;
          prev[nk] = k;
          heap.push(ng + h(m), nk);
        }
      }
    }
    if (bestState < 0) return straightLine(s, t);

    const nodes: Pt[] = [];
    let k = bestState;
    for (; prev[k] >= 0; k = prev[k]) {
      nodes.unshift({ x: xs[(k >> 2) % nx], y: ys[Math.floor((k >> 2) / nx)] });
      const a = k >> 2, b = prev[k] >> 2; // one grid step
      if (Math.abs(a - b) === 1) hUsed[Math.min(a, b)] = 1;
      else vUsed[Math.min(a, b)] = 1;
    }
    nodes.unshift({ x: xs[(k >> 2) % nx], y: ys[Math.floor((k >> 2) / nx)] });
    const start = starts.find((st) => st.n === k >> 2 && st.dir === (k & 3))!;
    const goal = goalOf.get(bestState >> 2)!;
    startPorts.add(portKey(start.port));
    return simplify([start.port, ...nodes, goal.port]);
  });
}

/** Routes for `edges`, in order. Unknown box ids must be filtered out by the caller. */
export function routeEdges(input: RouteInput): Pt[][] {
  return input.orthogonal ? routeOrthogonal(input) : routeStraight(input);
}
