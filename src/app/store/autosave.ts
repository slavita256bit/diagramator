import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { classesResized, classMoved } from "@/entities/diagram";
import { saveProject } from "@/features/save-project";
import type { AppDispatch, RootState } from "./index";

const AUTOSAVE_DELAY_MS = 800;

/** Debounced save after drags and style changes. */
export const autosave = createListenerMiddleware();

autosave.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(classMoved, classesResized),
  effect: async (_, api) => {
    api.cancelActiveListeners();
    await api.delay(AUTOSAVE_DELAY_MS);
    await api.dispatch(saveProject());
  },
});
