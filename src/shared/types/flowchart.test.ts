import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Flowchart } from "./flowchart.ts";

test("order flowchart retains valid ports and orthogonal routes", () => {
  const chart: Flowchart = JSON.parse(readFileSync(new URL("../../../examples/flowcharts/order.json", import.meta.url), "utf8"));
  assert.equal(chart.version, 1);
  const nodes = new Map(chart.nodes.map((node) => [node.id, node]));
  assert.equal(nodes.size, chart.nodes.length);
  for (const route of chart.routes) {
    assert.ok(route.points.length >= 2, route.id);
    const points = route.points.map((point) => {
      if (!("node" in point)) return point;
      const node = nodes.get(point.node);
      assert.ok(node, `${route.id}: unknown node ${point.node}`);
      const width = node.kind === "connector" ? 10 : 40;
      const height = node.kind === "terminal" || node.kind === "connector" ? 10 : 20;
      // Input/output symbols attach halfway along the slanted edge.
      const horizontal = node.kind === "input-output" ? width / 2 - height / 4 : width / 2;
      return { x: node.position.x + (point.side === "left" ? -horizontal : point.side === "right" ? horizontal : 0),
        y: node.position.y + (point.side === "top" ? -height / 2 : point.side === "bottom" ? height / 2 : 0) };
    });
    for (let i = 1; i < points.length; i++) {
      assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y, `${route.id} must be orthogonal`);
      assert.notDeepEqual(points[i], points[i - 1], `${route.id} must not contain zero-length segments`);
    }
  }
  for (const comment of chart.comments) assert.ok(nodes.has(comment.node), comment.id);
});
