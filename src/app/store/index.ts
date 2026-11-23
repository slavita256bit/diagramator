import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { diagramEditLabels, diagramSlice, loadSucceeded, redo, undo } from "@/entities/diagram";
import { relationTypeVisibilityToggled, settingsSlice, styleSet, themeSet } from "@/entities/settings";
import { autosave } from "./autosave";
import { routing } from "./routing";
import { persist } from "./persist";
import { withEditorHistory } from "./editorHistory";

const slices = combineReducers({ diagram: diagramSlice.reducer, settings: settingsSlice.reducer });
const rootReducer = withEditorHistory(
  (state: ReturnType<typeof slices> | undefined, action) =>
    slices(state && { diagram: state.diagram, settings: state.settings }, action),
  {
    ...diagramEditLabels,
    [styleSet.type]: "Change diagram style",
    [themeSet.type]: "Change app theme",
    [relationTypeVisibilityToggled.type]: "Change relationship visibility",
  },
  { undo: undo.type, redo: redo.type, reset: loadSucceeded.type, theme: themeSet.type },
);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().prepend(routing.middleware, autosave.middleware, persist.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
