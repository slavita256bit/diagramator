import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  classesResized,
  classMoved,
  classVisibilityToggled,
  relationAnchorsChanged,
  computeRoutesAsync,
  diagramArranged,
  loadSucceeded,
  routesUpdated,
} from "@/entities/diagram";
import { styleSet } from "@/entities/settings";
import type { AppDispatch, RootState } from "./index";

/** Re-route edges whenever boxes move/resize, auto-arrange runs, or the routing style changes. */
export const routing = createListenerMiddleware();

routing.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(relationAnchorsChanged, classVisibilityToggled, loadSucceeded, classMoved, classesResized, diagramArranged, styleSet),
  effect: async (_, api) => {
    // Coalesce bursts (multi-node drags dispatch one classMoved per node).
    api.cancelActiveListeners();
    await api.delay(0);
    const { diagram } = api.getState().diagram;
    if (!diagram) return;
    try {
      const routes = await computeRoutesAsync(diagram, api.getState().settings.style, api.signal);
      if (!api.signal.aborted) api.dispatch(routesUpdated(routes));
    } catch (error) {
      if (!api.signal.aborted) throw error;
    }
  },
});
