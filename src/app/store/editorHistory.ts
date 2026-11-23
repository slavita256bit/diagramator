import type { UnknownAction } from "@reduxjs/toolkit";
import type { DiagramState } from "@/entities/diagram";
import type { SettingsState } from "@/entities/settings";

type EditorState = {
  diagram: Pick<DiagramState, "diagram" | "exportPath" | "autoExport" | "saveStatus">;
  settings: Pick<SettingsState, "style" | "hiddenRelationTypes" | "theme">;
};

function snapshot({ diagram, settings }: EditorState) {
  return {
    diagram: diagram.diagram, exportPath: diagram.exportPath, autoExport: diagram.autoExport,
    style: settings.style, hiddenRelationTypes: settings.hiddenRelationTypes, theme: settings.theme,
  };
}

type Entry = { before: ReturnType<typeof snapshot>; label: string; themeOnly: boolean };
type History = {
  past: Entry[];
  future: Entry[];
  notice: { id: number; text: string } | null;
};

const empty: History = { past: [], future: [], notice: null };
const LIMIT = 50;

export function withEditorHistory<State extends EditorState>(
  reduce: (state: State | undefined, action: UnknownAction) => State,
  labels: Readonly<Record<string, string>>,
  actions: { undo: string; redo: string; reset: string; theme: string },
) {
  return (state: (State & { history: History }) | undefined, action: UnknownAction): State & { history: History } => {
    if (!state) return { ...reduce(undefined, action), history: empty };
    const { history } = state;
    if (action.type === actions.undo || action.type === actions.redo) {
      const undoing = action.type === actions.undo;
      const from = undoing ? history.past : history.future;
      const entry = from.at(-1);
      if (!entry) return state;

      const { diagram, exportPath, autoExport, style, hiddenRelationTypes, theme } = entry.before;
      const reverse = { ...entry, before: snapshot(state) };
      return {
        ...state,
        diagram: entry.themeOnly ? state.diagram : { ...state.diagram, diagram, exportPath, autoExport, saveStatus: "unsaved" },
        settings: entry.themeOnly ? { ...state.settings, theme } : { ...state.settings, style, hiddenRelationTypes },
        history: {
          past: undoing ? from.slice(0, -1) : [...history.past, reverse],
          future: undoing ? [...history.future, reverse] : from.slice(0, -1),
          notice: { id: (history.notice?.id ?? 0) + 1, text: `${undoing ? "Undid" : "Redid"} ${entry.label.toLowerCase()}` },
        },
      };
    }

    const next = reduce(state, action);
    if (action.type === actions.reset) return { ...next, history: empty };
    const label = Object.hasOwn(labels, action.type) ? labels[action.type] : undefined;
    if (label) {
      const before = snapshot(state);
      const after = snapshot(next);
      if (Object.keys(before).some((key) => before[key as keyof typeof before] !== after[key as keyof typeof after])) {
        return { ...next, history: {
          ...history, past: [...history.past, { before, label, themeOnly: action.type === actions.theme }].slice(-LIMIT), future: [],
        } };
      }
    }
    return next.diagram === state.diagram && next.settings === state.settings ? state : { ...next, history };
  };
}
