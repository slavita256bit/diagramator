import type { Point } from "@/shared/types";
import type { Rect, RouteInput } from "./routing";

export interface RoutingRequest extends Omit<RouteInput, "boxes"> {
  boxes: [string, Rect][];
}
interface Job {
  id: number;
  input: RoutingRequest;
  fallback: () => Point[][];
  resolve: (routes: Point[][]) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  abort: () => void;
}

let worker: Worker | null | undefined;
let active: Job | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 0;
const queue: Job[] = [];
const aborted = () => new DOMException("Routing cancelled", "AbortError");

function complete(routes?: Point[][], error?: unknown) {
  const job = active;
  if (!job) return;
  active = undefined;
  clearTimeout(timer);
  job.signal?.removeEventListener("abort", job.abort);
  if (!job.signal?.aborted) {
    if (error !== undefined) job.reject(error);
    else job.resolve(routes!);
  }
  pump();
}

function fallback() {
  // Includes worker startup/CSP failures: pending jobs must never stay unresolved.
  if (worker) {
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
  }
  worker = null;
  if (!active) return;
  if (active.signal?.aborted) { complete(); return; }
  try { complete(active.fallback()); } catch (error) { complete(undefined, error); }
}

function pump() {
  if (active || !queue.length) return;
  active = queue.shift()!;
  if (worker === undefined) {
    try {
      worker = new Worker(new URL("./routing.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ id: number; routes: Point[][]; error?: string }>) => {
        if (event.data.id !== active?.id) return;
        if (event.data.error) fallback(); else complete(event.data.routes);
      };
      worker.onerror = (event) => { event.preventDefault(); fallback(); };
      worker.onmessageerror = fallback;
    } catch { worker = null; }
  }
  if (!worker) { fallback(); return; }
  // Only one request enters the worker at a time. Aborted queued drag frames are discarded.
  timer = setTimeout(fallback, 15_000);
  try { worker.postMessage({ id: active.id, ...active.input }); } catch { fallback(); }
}

export function routeInWorker(input: RoutingRequest, runFallback: () => Point[][], signal?: AbortSignal): Promise<Point[][]> {
  if (signal?.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const job: Job = { id: nextId++, input, fallback: runFallback, resolve, reject, signal, abort: () => {
      const index = queue.indexOf(job);
      if (index >= 0) queue.splice(index, 1);
      signal?.removeEventListener("abort", job.abort);
      reject(aborted());
    } };
    signal?.addEventListener("abort", job.abort, { once: true });
    queue.push(job);
    pump();
  });
}
