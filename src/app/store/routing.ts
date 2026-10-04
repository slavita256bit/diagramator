import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  classesResized,
  classMoved,
  computeRoutes,
  diagramArranged,
  loadSucceeded,
  routesUpdated,
} from "@/entities/diagram";
import { styleSet } from "@/entities/settings";
import type { AppDispatch, RootState } from "./index";

/** Re-route edges whenever boxes move/resize, auto-arrange runs, or the routing style changes. */
export const routing = createListenerMiddleware();

routing.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(loadSucceeded, classMoved, classesResized, diagramArranged, styleSet),
  effect: async (_, api) => {
    // Coalesce bursts (multi-node drags dispatch one classMoved per node).
    api.cancelActiveListeners();
    await api.delay(0);
    const { diagram } = api.getState().diagram;
    if (diagram) api.dispatch(routesUpdated(computeRoutes(diagram, api.getState().settings.style.orthogonalEdges)));
  },
});
