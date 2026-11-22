import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import {
  classesResized,
  exportPathChanged,
  saveStatusChanged,
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
  classVisibilityToggled,
  classesHidden,
  nodesMoved,
  undo,
  redo,
  relationAnchorsChanged,
} from "@/entities/diagram";
import { saveProject } from "@/features/save-project";
import { relationTypeVisibilityToggled } from "@/entities/settings";
import type { AppDispatch, RootState } from "./index";

const AUTOSAVE_DELAY_MS = 800;

/** Debounced save after drags, style changes, auto-arrange, collapse and note edits. */
export const autosave = createListenerMiddleware();

autosave.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(
    classMoved,
    exportPathChanged,
    relationTypeVisibilityToggled,
    nodesMoved,
    classesResized,
    diagramArranged,
    sectionCollapseToggled,
    classVisibilityToggled,
    classesHidden,
    undo,
    redo,
    relationAnchorsChanged,
    noteAdded,
    noteMoved,
    noteResized,
    noteTextChanged,
    noteImageSet,
    noteLinked,
    noteRemoved,
  ),
  effect: async (action, api) => {
    if (relationTypeVisibilityToggled.match(action) && api.getState().diagram.diagram) {
      api.dispatch(saveStatusChanged("unsaved"));
    }
    api.cancelActiveListeners();
    await api.delay(AUTOSAVE_DELAY_MS);
    await api.dispatch(saveProject());
  },
});
