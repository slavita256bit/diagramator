import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockBounds, canvasPoint, commentBounds, connectBlocks, labelPosition, moveBlock, nearestSegment, parseFlowchart, placeNewBlock, resolvePoint, routeFraction, routeGeometry, shiftSegment, simplifyRoute, snapBlock } from "./flowchart.ts";
import type { FlowchartLabel, FlowchartNode } from "../../../shared/types/flowchart.ts";

test("the editor accepts the existing example and rejects broken references", () => {
  const content = readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8");
  const chart = parseFlowchart(content);
  assert.equal(chart.nodes.length, 16);
  chart.routes[0].points[0] = { node: "nonexistent-node", side: "top" };
  assert.throws(() => parseFlowchart(JSON.stringify(chart)), /Invalid point/);
  assert.throws(() => parseFlowchart('{"version":2}'), /not a supported/);
});

test("moving a block keeps connected lines orthogonal and other routes unchanged", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  const moved = moveBlock(chart, "start", { x: 75, y: 10 });
  const route = moved.routes[0];
  const points = routeGeometry(route, moved.nodes);
  assert.equal(points.length, 4);
  assert.equal(points[0].x, points[1].x);
  assert.equal(points.at(-1)!.x, points.at(-2)!.x);
  for (let i = 1; i < points.length; i++) assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y);
  assert.deepEqual(moved.routes[1], chart.routes[1]);
  assert.equal(chart.nodes[0].position.x, 55);
  const restored = moveBlock(moved, "start", chart.nodes[0].position);
  assert.deepEqual(restored.routes, chart.routes);
  assert.deepEqual(routeGeometry(restored.routes[0], restored.nodes), routeGeometry(chart.routes[0], chart.nodes));
});

test("coincident points remain editable while diagonal constraints resolve orthogonally", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  const touching = moveBlock(chart, "start", { x: 55, y: 20 });
  assert.equal(routeGeometry(touching.routes[0], touching.nodes).length, 1);
  assert.doesNotThrow(() => parseFlowchart(JSON.stringify(touching)));
  const route = { id: "manual", arrow: true, points: [{ x: 10, y: 10 }, { x: 20, y: 20 }] };
  assert.deepEqual(routeGeometry(route, chart.nodes), [{ x: 10, y: 10 }, { x: 10, y: 20 }, { x: 20, y: 20 }]);
});

test("new routes connect actual ports without redundant bends", () => {
  const node = (id: string, x: number, y: number): FlowchartNode => ({ id, kind: "terminal", position: { x, y }, text: "" });
  const a = node("a", 10, 10), b = node("b", 10, 50);
  const direct = connectBlocks(a, b, "r");
  assert.equal(direct.points.length, 2);
  const bent = connectBlocks(a, node("c", 30, 50), "r2");
  const points = bent.points.map((p) => resolvePoint(p, [a, node("c", 30, 50)]));
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y);
    assert.notDeepEqual(points[i], points[i - 1]);
  }
  assert.throws(() => connectBlocks(a, node("d", 10, 20), "r3"), /Move the blocks/);
});

test("a moved block carries its branch label and the connection's shared junction", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  const moved = moveBlock(chart, "remaining", { x: 60, y: 164 });
  const junctions = [{ id: "merge", anchor: { node: "remaining", side: "top" as const }, position: { x: 0, y: -4 } }];
  const junction = { junction: "merge" };
  const label = { id: "label", anchor: { node: "remaining", side: "right" as const }, position: { x: 8, y: -5 }, width: 12, text: "Нет" };
  assert.deepEqual(resolvePoint(junction, moved.nodes, junctions), { x: 60, y: 150 });
  assert.deepEqual(labelPosition(label, moved.nodes), { x: 88, y: 159 });
  const points = routeGeometry({ ...moved.routes[6], points: [moved.routes[6].points[0], junction, moved.routes[6].points[1]] }, moved.nodes, junctions);
  assert.ok(points.some((point) => point.x === 60 && point.y === 150));
});

test("legacy SVG transforms work for block and connection pointer coordinates", () => {
  const matrix = { a: 3, b: 0, c: 0, d: 3, e: -30, f: -90 };
  const point = canvasPoint(matrix, { x: 30, y: 60 });
  assert.deepEqual(point, { x: 20, y: 50 });
  assert.equal(nearestSegment([{ x: 0, y: 48 }, { x: 40, y: 48 }, { x: 40, y: 70 }], point!), 0);
  assert.equal(canvasPoint({ ...matrix, a: 0 }, { x: 30, y: 60 }), null);
});

test("connection labels follow the wire when its bend moves", () => {
  const label: FlowchartLabel = { id: "label", anchor: { route: "r", along: 0.5 },
    position: { x: 2, y: -3 }, width: 12, text: "Yes" };
  const points = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }];
  assert.equal(routeFraction(points, { x: 20, y: 3 }), 0.575);
  assert.deepEqual(labelPosition(label, [], new Map([["r", points]])), { x: 22, y: -3 });
  const moved = [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 20, y: 20 }];
  assert.deepEqual(labelPosition(label, [], new Map([["r", moved]])), { x: 2, y: 17 });
});

test("magnetic alignment snaps nearby edges and centers independently", () => {
  const block: FlowchartNode = { id: "moving", kind: "process", position: { x: 10, y: 20 }, text: "" };
  const target: FlowchartNode = { id: "target", kind: "connector", position: { x: 40, y: 60 }, text: "" };
  assert.deepEqual(snapBlock([block, target], block, { x: 26, y: 61 }, 2),
    { point: { x: 25, y: 60 }, guides: { x: 45, y: 60 } });
  assert.deepEqual(snapBlock([block, target], block, { x: 32, y: 63 }, 2),
    { point: { x: 32, y: 63 }, guides: {} });
});

test("moving a connection segment keeps its ports and eliminates redundant corners", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  const route = chart.routes[0];
  const points = routeGeometry(route, chart.nodes);
  const rerouted = shiftSegment(chart, route, points, 0, { x: 65, y: 20 });
  assert.deepEqual(rerouted.points[0], route.points[0]);
  assert.deepEqual(rerouted.points.at(-1), route.points.at(-1));
  assert.deepEqual(simplifyRoute(routeGeometry(rerouted, chart.nodes)), [
    { x: 55, y: 15 }, { x: 55, y: 17 }, { x: 65, y: 17 },
    { x: 65, y: 23 }, { x: 55, y: 23 }, { x: 55, y: 25 },
  ]);
  assert.deepEqual(simplifyRoute([{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }]),
    [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }]);
  const junction = { x: 4, y: 0 };
  assert.deepEqual(simplifyRoute([{ x: 0, y: 0 }, { x: 2, y: 0 }, junction, { x: 8, y: 0 }], [junction]),
    [{ x: 0, y: 0 }, junction, { x: 8, y: 0 }]);
});

test("per-block font sizes survive reload and old blocks use the canvas setting", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  chart.nodes[0].textSize = 12.5;
  const restored = parseFlowchart(JSON.stringify(chart));
  assert.equal(restored.nodes[0].textSize, 12.5);
  assert.equal(restored.nodes[1].textSize, undefined);
  chart.nodes[0].textSize = -1;
  assert.throws(() => parseFlowchart(JSON.stringify(chart)), /Invalid block text size/);
});

test("new blocks avoid comments and appear in the visible area when there is room", () => {
  const chart = parseFlowchart(readFileSync(new URL("../../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  const visible = { x: 75, y: 0, w: 140, h: 95 };
  const next = placeNewBlock(chart, "process", "new", visible)!;
  const block = blockBounds(next.nodes.at(-1)!);
  assert.ok(block.x >= visible.x && block.x + block.w <= visible.x + visible.w);
  assert.ok(block.y >= visible.y && block.y + block.h <= visible.y + visible.h);
  for (const comment of chart.comments) {
    const box = commentBounds(comment, chart);
    assert.ok(block.x >= box.x + box.w || block.x + block.w <= box.x ||
      block.y >= box.y + box.h || block.y + block.h <= box.y);
  }
  const packed = { ...chart, canvas: { ...chart.canvas, width: 48, height: 28 },
    nodes: [{ ...chart.nodes[0], kind: "process" as const, position: { x: 24, y: 14 } }],
    comments: [], labels: [], routes: [] };
  const expanded = placeNewBlock(packed, "process", "new")!;
  assert.ok(blockBounds(expanded.nodes.at(-1)!).y > packed.canvas.height);
});
