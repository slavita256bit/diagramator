import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  classesResized,
  classMoved,
  classVisibilityToggled,
  classesHidden,
  nodesMoved,
  undo,
  redo,
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
  matcher: isAnyOf(relationAnchorsChanged, classVisibilityToggled, classesHidden, loadSucceeded, classMoved, nodesMoved, classesResized, diagramArranged, styleSet, undo, redo),
  effect: async (action, api) => {
    if (undo.match(action) || redo.match(action)) {
      const before = api.getOriginalState();
      const after = api.getState();
      if (before.diagram.diagram === after.diagram.diagram && before.settings.style === after.settings.style) return;
    }
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
