// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { routeEdges, segmentHitsRect, type Pt, type Rect } from "./routing.ts";

// A above C, blocker B right between them.
const boxes = new Map<string, Rect>([
  ["a", { x: 0, y: 0, w: 100, h: 60 }],
  ["b", { x: -20, y: 150, w: 140, h: 60 }],
  ["c", { x: 0, y: 300, w: 100, h: 60 }],
  ["d", { x: 400, y: 0, w: 100, h: 60 }],
]);
const others = (route: Pt[], skip: string[]) =>
  [...boxes].filter(([id]) => !skip.includes(id)).map(([, r]) => r);
const crosses = (route: Pt[], rects: Rect[]) =>
  route.some((p, i) => i > 0 && rects.some((r) => segmentHitsRect(route[i - 1], p, r)));
const onBorder = (p: Pt, r: Rect) =>
  (Math.abs(p.x - r.x) < 0.5 || Math.abs(p.x - r.x - r.w) < 0.5 || Math.abs(p.y - r.y) < 0.5 || Math.abs(p.y - r.y - r.h) < 0.5) &&
  p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5;

for (const orthogonal of [false, true]) {
  test(`${orthogonal ? "orthogonal" : "straight"}: avoids boxes, ends on borders`, () => {
    const edges = [
      { source: "c", target: "a" }, // must detour around b
      { source: "a", target: "d" }, // free
    ];
    const routes = routeEdges({ boxes, edges, orthogonal });
    edges.forEach((e, i) => {
      const r = routes[i];
      assert.ok(r.length >= 2);
      assert.ok(!crosses(r, others(r, [e.source, e.target])), `edge ${i} crosses a box: ${JSON.stringify(r)}`);
      assert.ok(onBorder(r[0], boxes.get(e.source)!), `edge ${i} start`);
      assert.ok(onBorder(r[r.length - 1], boxes.get(e.target)!), `edge ${i} end`);
      if (orthogonal) {
        r.slice(1).forEach((p, k) => assert.ok(p.x === r[k].x || p.y === r[k].y, `edge ${i} not orthogonal`));
      }
    });
    assert.ok(routes[0].length > 2, "blocked edge detours");
    if (!orthogonal) assert.equal(routes[1].length, 2, "free edge stays straight");
  });
}
