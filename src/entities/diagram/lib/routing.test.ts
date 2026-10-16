// Run: pnpm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { anchorPort, nearestAnchor, snapAnchor, routeEdges, segmentHitsRect, type Pt, type Rect } from "./routing.ts";

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

function assertVerticalRoute(route: Pt[], source: Rect, target: Rect) {
  assert.ok(route.length >= 2);
  assert.equal(route[0].y, source.y, "leaves the top");
  assert.equal(route[1].x, route[0].x);
  assert.ok(route[1].y < route[0].y, "leaves upwards");
  const last = route.length - 1;
  assert.equal(route[last].y, target.y + target.h, "enters the bottom");
  assert.equal(route[last - 1].x, route[last].x);
  assert.ok(route[last - 1].y > route[last].y, "arrives upwards");
  for (let i = 1; i < route.length; i++) {
    assert.ok(route[i].x === route[i - 1].x || route[i].y === route[i - 1].y, "right-angle segments");
  }
}

test("orthogonal: top-to-bottom ports above, below, beside and on a self-loop", () => {
  for (const target of [
    { x: 0, y: -240, w: 100, h: 60 },
    { x: 0, y: 240, w: 100, h: 60 },
    { x: 240, y: 0, w: 100, h: 60 },
  ]) {
    const source = { x: 0, y: 0, w: 100, h: 60 };
    const nodes = new Map([["s", source], ["t", target]]);
    const [route] = routeEdges({ boxes: nodes, edges: [{ source: "s", target: "t" }], orthogonal: true });
    assertVerticalRoute(route, source, target);
    assert.ok(!crosses(route, [...nodes.values()]), "does not cross endpoint boxes");
  }
  const source = { x: 0, y: 0, w: 100, h: 60 };
  const [loop] = routeEdges({ boxes: new Map([["s", source]]), edges: [{ source: "s", target: "s" }], orthogonal: true });
  assertVerticalRoute(loop, source, source);
  assert.ok(!crosses(loop, [source]));
});

test("orthogonal: ordered ports spread fan-out and fan-in without overlapping markers", () => {
  const nodes = new Map<string, Rect>([
    ["base", { x: 200, y: 0, w: 160, h: 60 }],
    ["left", { x: 0, y: 300, w: 160, h: 60 }],
    ["right", { x: 400, y: 300, w: 160, h: 60 }],
  ]);
  const edges = [
    { source: "right", target: "base" },
    { source: "left", target: "base" },
    { source: "base", target: "right" },
    { source: "base", target: "left" },
  ];
  const routes = routeEdges({ boxes: nodes, edges, orthogonal: true, options: { edgeMergeTargets: false } });
  routes.forEach((route, i) => {
    assertVerticalRoute(route, nodes.get(edges[i].source)!, nodes.get(edges[i].target)!);
    assert.ok(!crosses(route, [...nodes.values()]));
  });
  assert.ok(routes[0].at(-1)!.x > routes[1].at(-1)!.x, "right child enters right port");
  assert.ok(routes[2][0].x > routes[3][0].x, "right target gets right start port");
  assert.deepEqual(routes, routeEdges({ boxes: nodes, edges, orthogonal: true, options: { edgeMergeTargets: false } }), "stable routes");
});

test("orthogonal: overlapping boxes never cause a diagonal fallback", () => {
  const source = { x: 0, y: 0, w: 100, h: 60 };
  const target = { x: 10, y: -10, w: 100, h: 60 };
  const [route] = routeEdges({ boxes: new Map([["s", source], ["t", target]]), edges: [{ source: "s", target: "t" }], orthogonal: true });
  assertVerticalRoute(route, source, target);
});

test("orthogonal: merged incoming arrows share a final trunk even at rest", () => {
  const nodes = new Map<string, Rect>([
    ["base", { x: 200, y: 0, w: 160, h: 60 }],
    ["left", { x: 0, y: 300, w: 160, h: 60 }],
    ["right", { x: 400, y: 300, w: 160, h: 60 }],
  ]);
  const edges = [{ source: "left", target: "base" }, { source: "right", target: "base" }];
  const routes = routeEdges({ boxes: nodes, edges, orthogonal: true, options: { edgeMergeTargets: true } });
  assert.deepEqual(routes[0].at(-1), routes[1].at(-1));
  const end = routes[0].at(-1)!;
  for (const route of routes) {
    const before = route.at(-2)!;
    assert.equal(before.x, end.x);
    assert.ok(before.y > end.y + 12, "shared vertical approach extends beyond the port stub");
    assert.ok(!crosses(route, [...nodes.values()]));
  }
});

test("orthogonal: manual side attachments override defaults and follow box resizing", () => {
  const source = { x: 0.123, y: 0.456, w: 120, h: 90 };
  const target = { x: 360, y: 0, w: 120, h: 90 };
  const anchors = { source: { side: "right" as const, offset: 0.25 }, target: { side: "left" as const, offset: 0.75 } };
  const route = () => routeEdges({ boxes: new Map([["s", source], ["t", target]]),
    edges: [{ source: "s", target: "t", anchors }], orthogonal: true })[0];
  for (const height of [90, 180]) {
    source.h = height;
    const pts = route();
    assert.deepEqual(pts[0], anchorPort(source, anchors.source, 12).port);
    assert.deepEqual(pts.at(-1), anchorPort(target, anchors.target, 12).port);
    assert.ok(pts[1].x > pts[0].x);
    assert.ok(pts.at(-2)!.x < pts.at(-1)!.x);
    assert.ok(!crosses(pts, [source, target]));
    pts.slice(1).forEach((p, i) => assert.ok(p.x === pts[i].x || p.y === pts[i].y));
  }
  assert.equal(nearestAnchor({ x: target.x, y: 45 }, target).side, "left");
  assert.equal(nearestAnchor({ x: 0, y: -10 }, source).side, "top");
});

test("orthogonal: side and clearance settings control the route", () => {
  const source = { x: 0, y: 0, w: 100, h: 60 };
  const target = { x: 300, y: 200, w: 100, h: 60 };
  const [route] = routeEdges({ boxes: new Map([["s", source], ["t", target]]),
    edges: [{ source: "s", target: "t" }], orthogonal: true,
    options: { edgeSourceSide: "right", edgeTargetSide: "left", edgeClearance: 30, edgeBendPenalty: 80 } });
  assert.equal(route[0].x, source.x + source.w);
  assert.equal(route.at(-1)!.x, target.x);
  assert.ok(route[1].x >= route[0].x + 30);
  assert.ok(route.at(-2)!.x <= route.at(-1)!.x - 30);
  assert.ok(!crosses(route, [source, target]));
});

test("orthogonal: different UML arrowheads keep distinct target ports", () => {
  const nodes = new Map<string, Rect>([
    ["base", { x: 150, y: 0, w: 160, h: 60 }],
    ["a", { x: 0, y: 300, w: 100, h: 60 }],
    ["b", { x: 350, y: 300, w: 100, h: 60 }],
  ]);
  const [a, b] = routeEdges({ boxes: nodes, orthogonal: true,
    edges: [{ source: "a", target: "base", type: "inheritance" }, { source: "b", target: "base", type: "dependency" }] });
  assert.notDeepEqual(a.at(-1), b.at(-1));
});


test("connection snapping: gentle quarter-point attraction leaves other positions free", () => {
  const box = { x: 0, y: 0, w: 200, h: 100 };
  for (const side of ["top", "bottom", "left", "right"] as const) {
    for (const offset of [0.25, 0.5, 0.75]) {
      assert.equal(snapAnchor({ side, offset: offset + 0.015 }, box, 1).offset, offset);
    }
    assert.equal(snapAnchor({ side, offset: 0.38 }, box, 1).offset, 0.38);
    assert.equal(snapAnchor({ side, offset: 0.38 }, box, 1, true).offset, 0.5);
    assert.equal(snapAnchor({ side, offset: 0.92 }, box, 1, true).offset, 0.75);
  }
});

test("connection snapping: magnetic range follows zoom and stays small on narrow sides", () => {
  const box = { x: 0, y: 0, w: 400, h: 100 };
  const anchor = { side: "top" as const, offset: 0.52 };
  assert.equal(snapAnchor(anchor, box, 0.5).offset, 0.5, "4 screen pixels snaps");
  assert.equal(snapAnchor(anchor, box, 1).offset, 0.52, "8 screen pixels stays free");
  assert.equal(snapAnchor(anchor, box, 2, true).offset, 0.5, "Shift ignores distance and zoom");
  assert.equal(snapAnchor({ side: "left", offset: 0.44 }, box, 0.1).offset, 0.44, "small side keeps free space");
});
