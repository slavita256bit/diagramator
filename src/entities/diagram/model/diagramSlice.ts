import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Diagram } from "@/shared/types";

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

export interface DiagramState {
  diagram: Diagram | null;
  /** Directory the diagram was generated from. */
  source: string | null;
  status: LoadStatus;
  error: string | null;
}

const initialState: DiagramState = {
  diagram: null,
  source: null,
  status: "idle",
  error: null,
};

export const diagramSlice = createSlice({
  name: "diagram",
  initialState,
  reducers: {
    loadStarted(state, action: PayloadAction<string | null>) {
      state.status = "loading";
      state.error = null;
      state.source = action.payload;
    },
    loadSucceeded(state, action: PayloadAction<Diagram>) {
      state.status = "succeeded";
      state.diagram = action.payload;
    },
    loadFailed(state, action: PayloadAction<string>) {
      state.status = "failed";
      state.error = action.payload;
    },
    errorDismissed(state) {
      state.error = null;
    },
    /** Persist a user drag back into the IR so exports use the edited layout. */
    classMoved(state, action: PayloadAction<{ id: string; x: number; y: number }>) {
      const cls = state.diagram?.classes.find((c) => c.id === action.payload.id);
      if (cls) {
        cls.position.x = action.payload.x;
        cls.position.y = action.payload.y;
      }
    },
    /** New box sizes after a style change (see `measureClass`). */
    classesResized(state, action: PayloadAction<Record<string, { width: number; height: number }>>) {
      for (const cls of state.diagram?.classes ?? []) {
        const size = action.payload[cls.id];
        if (size) Object.assign(cls.position, size);
      }
    },
  },
  selectors: {
    selectDiagram: (s) => s.diagram,
    selectSource: (s) => s.source,
    selectStatus: (s) => s.status,
    selectError: (s) => s.error,
  },
});

export const { loadStarted, loadSucceeded, loadFailed, errorDismissed, classMoved, classesResized } =
  diagramSlice.actions;
export const { selectDiagram, selectSource, selectStatus, selectError } = diagramSlice.selectors;
