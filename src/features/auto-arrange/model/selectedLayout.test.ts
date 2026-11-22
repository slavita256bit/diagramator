import { test } from "node:test";
import assert from "node:assert/strict";
import { spaceLayout } from "./selectedLayout.ts";
import type { ClassNode } from "../../../shared/types/diagram.ts";

test("selected layout spaces rows using measured class sizes", () => {
  const cls = (id: string, x: number, y: number, width: number, height: number): ClassNode => ({
    id, name: id, kind: "class", attributes: [], methods: [], templateParams: [],
    attributesCollapsed: false, methodsCollapsed: false, position: { x, y, width, height },
  });
  const input = [cls("a", 0, 0, 500, 300), cls("b", 200, 0, 100, 40), cls("c", 0, 200, 100, 80)];
  const output = spaceLayout(input);
  assert.deepEqual(output.map((c) => [c.position.x, c.position.y]), [[0, 0], [560, 0], [0, 400]]);
  assert.equal(input[1].position.x, 200, "does not mutate the original layout");
});
