import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Diagram, Point } from "@/shared/types";

export type LoadStatus = "idle" | "loading" | "succeeded" | "failed";
export type SaveStatus = "saved" | "unsaved" | "saving" | "failed";

export interface DiagramState {
  diagram: Diagram | null;
  /** Directory the diagram was generated from. */
  source: string | null;
  status: LoadStatus;
  error: string | null;
  /** Folder that receives `diagramator.json`; null for diagrams loaded from Doxygen XML. */
  projectDir: string | null;
  saveStatus: SaveStatus;
}

const initialState: DiagramState = {
  diagram: null,
  source: null,
  status: "idle",
  error: null,
  projectDir: null,
  saveStatus: "saved",
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
    loadSucceeded(state, action: PayloadAction<{ diagram: Diagram; projectDir: string | null }>) {
      state.status = "succeeded";
      state.diagram = action.payload.diagram;
      state.projectDir = action.payload.projectDir;
      state.saveStatus = "saved";
    },
    /** Edge routes, index-aligned with `relations` (see `computeRoutes`). */
    routesUpdated(state, action: PayloadAction<Point[][]>) {
      state.diagram?.relations.forEach((r, i) => {
        r.route = action.payload[i];
      });
    },
    saveStatusChanged(state, action: PayloadAction<SaveStatus>) {
      state.saveStatus = action.payload;
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
        state.saveStatus = "unsaved";
      }
    },
    /** New box sizes after a style change (see `measureClass`). */
    classesResized(state, action: PayloadAction<Record<string, { width: number; height: number }>>) {
      for (const cls of state.diagram?.classes ?? []) {
        const size = action.payload[cls.id];
        if (size) Object.assign(cls.position, size);
      }
      state.saveStatus = "unsaved";
    },
  },
  selectors: {
    selectDiagram: (s) => s.diagram,
    selectSource: (s) => s.source,
    selectStatus: (s) => s.status,
    selectError: (s) => s.error,
    selectProjectDir: (s) => s.projectDir,
    selectSaveStatus: (s) => s.saveStatus,
  },
});

export const { loadStarted, loadSucceeded, loadFailed, errorDismissed, classMoved, classesResized, saveStatusChanged, routesUpdated } =
  diagramSlice.actions;
export const { selectDiagram, selectSource, selectStatus, selectError, selectProjectDir, selectSaveStatus } = diagramSlice.selectors;
