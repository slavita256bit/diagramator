/// <reference lib="webworker" />
import { routeEdges } from "./routing";
import type { RoutingRequest } from "./routingWorker";

self.onmessage = (event: MessageEvent<RoutingRequest & { id: number }>) => {
  const { id, boxes, ...input } = event.data;
  try {
    self.postMessage({ id, routes: routeEdges({ ...input, boxes: new Map(boxes) }) });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
