import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Diagram, Note, Point } from "@/shared/types";

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
    /** Replaces the diagram after re-running auto-layout ("Auto-arrange"). */
    diagramArranged(state, action: PayloadAction<Diagram>) {
      state.diagram = action.payload;
      state.saveStatus = "unsaved";
    },
    /** Toggles one class's attributes or methods section. Resizing happens separately
     * (see `applyStyle`'s `classesResized` pattern), dispatched right after this. */
    sectionCollapseToggled(state, action: PayloadAction<{ classId: string; section: "attributes" | "methods" }>) {
      const cls = state.diagram?.classes.find((c) => c.id === action.payload.classId);
      if (!cls) return;
      if (action.payload.section === "attributes") cls.attributesCollapsed = !cls.attributesCollapsed;
      else cls.methodsCollapsed = !cls.methodsCollapsed;
      state.saveStatus = "unsaved";
    },
    noteAdded(state, action: PayloadAction<Note>) {
      state.diagram?.notes.push(action.payload);
      state.saveStatus = "unsaved";
    },
    noteMoved(state, action: PayloadAction<{ id: string; x: number; y: number }>) {
      const note = state.diagram?.notes.find((n) => n.id === action.payload.id);
      if (note) {
        note.position.x = action.payload.x;
        note.position.y = action.payload.y;
        state.saveStatus = "unsaved";
      }
    },
    noteResized(state, action: PayloadAction<{ id: string; x: number; y: number; width: number; height: number }>) {
      const note = state.diagram?.notes.find((n) => n.id === action.payload.id);
      if (note) {
        Object.assign(note.position, action.payload);
        state.saveStatus = "unsaved";
      }
    },
    noteTextChanged(state, action: PayloadAction<{ id: string; text: string }>) {
      const note = state.diagram?.notes.find((n) => n.id === action.payload.id);
      if (note) {
        note.text = action.payload.text;
        state.saveStatus = "unsaved";
      }
    },
    noteImageSet(state, action: PayloadAction<{ id: string; image: string | undefined }>) {
      const note = state.diagram?.notes.find((n) => n.id === action.payload.id);
      if (note) {
        note.image = action.payload.image;
        state.saveStatus = "unsaved";
      }
    },
    noteLinked(state, action: PayloadAction<{ id: string; classId: string | null }>) {
      const note = state.diagram?.notes.find((n) => n.id === action.payload.id);
      if (note) {
        note.linkedClass = action.payload.classId ?? undefined;
        state.saveStatus = "unsaved";
      }
    },
    noteRemoved(state, action: PayloadAction<string>) {
      if (!state.diagram) return;
      state.diagram.notes = state.diagram.notes.filter((n) => n.id !== action.payload);
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

export const {
  loadStarted,
  loadSucceeded,
  loadFailed,
  errorDismissed,
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
  saveStatusChanged,
  routesUpdated,
} = diagramSlice.actions;
export const { selectDiagram, selectSource, selectStatus, selectError, selectProjectDir, selectSaveStatus } = diagramSlice.selectors;
