import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  classesResized,
  classMoved,
  diagramArranged,
  noteAdded,
  noteImageSet,
  noteLinked,
  noteMoved,
  noteRemoved,
  noteResized,
  noteTextChanged,
  sectionCollapseToggled,
} from "@/entities/diagram";
import { saveProject } from "@/features/save-project";
import type { AppDispatch, RootState } from "./index";

const AUTOSAVE_DELAY_MS = 800;

/** Debounced save after drags, style changes, auto-arrange, collapse and note edits. */
export const autosave = createListenerMiddleware();

autosave.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(
    classMoved,
    classesResized,
    diagramArranged,
    sectionCollapseToggled,
    noteAdded,
    noteMoved,
    noteResized,
    noteTextChanged,
    noteImageSet,
    noteLinked,
    noteRemoved,
  ),
  effect: async (_, api) => {
    api.cancelActiveListeners();
    await api.delay(AUTOSAVE_DELAY_MS);
    await api.dispatch(saveProject());
  },
});
