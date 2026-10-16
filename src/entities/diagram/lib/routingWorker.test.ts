import { test } from "node:test";
import assert from "node:assert/strict";
import { routeEdges } from "./routing.ts";
import { routeInWorker } from "./routingWorker.ts";

// Exercise scheduling/failure paths without relying on browser Worker availability.
test("worker routing cancels stale frames, preserves geometry and recovers from worker errors", async () => {
  const previousWorker = globalThis.Worker;
  let instance;
  class FakeWorker {
    messages = [];
    onmessage = null;
    onerror = null;
    onmessageerror = null;
    terminated = false;
    constructor() { instance = this; }
    postMessage(value) { this.messages.push(value); }
    terminate() { this.terminated = true; }
    reply(index) {
      const { id, boxes, ...input } = this.messages[index];
      this.onmessage?.({ data: { id, routes: routeEdges({ ...input, boxes: new Map(boxes) }) } });
    }
  }
  globalThis.Worker = FakeWorker;
  try {
    const input = {
      boxes: [["a", { x: 0, y: 200, w: 100, h: 60 }], ["b", { x: 200, y: 0, w: 100, h: 60 }]],
      edges: [{ source: "a", target: "b", type: "inheritance", anchors: { target: { side: "left", offset: 0.25 } } }],
      orthogonal: true,
      options: { edgeClearance: 24, edgeMergeTargets: true },
    };
    const expected = routeEdges({ ...input, boxes: new Map(input.boxes) });
    let fallbacks = 0;
    const fallback = () => { fallbacks++; return expected; };
    const first = new AbortController(), stale = new AbortController();
    const a = routeInWorker(input, fallback, first.signal);
    const b = routeInWorker(input, fallback, stale.signal);
    const c = routeInWorker(input, fallback);
    assert.equal(instance.messages.length, 1, "only one calculation sent to worker at a time");
    stale.abort();
    first.abort();
    await assert.rejects(b, { name: "AbortError" });
    await assert.rejects(a, { name: "AbortError" });
    instance.reply(0);
    assert.equal(instance.messages.length, 2, "queued stale frame was discarded");
    instance.reply(1);
    assert.deepEqual(await c, expected, "manual attachment and settings survive worker boundary");
    assert.equal(fallbacks, 0);
    const failed = routeInWorker(input, fallback);
    instance.onerror({ preventDefault() {} });
    assert.deepEqual(await failed, expected);
    assert.ok(instance.terminated);
    assert.deepEqual(await routeInWorker(input, fallback), expected, "later jobs use fallback");
    assert.equal(fallbacks, 2);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(routeInWorker(input, fallback, cancelled.signal), { name: "AbortError" });
    assert.equal(fallbacks, 2, "already cancelled request does no work");
  } finally {
    globalThis.Worker = previousWorker;
  }
});
