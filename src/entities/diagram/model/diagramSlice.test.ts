import { test } from "node:test";
import assert from "node:assert/strict";
import { classesHidden, classVisibilityToggled, diagramEditLabels, diagramSlice, exportPathChanged, loadSucceeded, nodesMoved, redo, routesUpdated, undo } from "./diagramSlice.ts";
import { withEditorHistory } from "../../../app/store/editorHistory.ts";
import type { StyleProfile } from "../../../shared/types/style.ts";
import type { Diagram } from "../../../shared/types/diagram.ts";

const makeDiagram = (): Diagram => ({
  classes: ["a", "b"].map((id) => ({ id, name: id, kind: "class", attributes: [], methods: [], templateParams: [],
    attributesCollapsed: false, methodsCollapsed: false, position: { x: 0, y: 0, width: 100, height: 80 } })),
  relations: [{ source: "a", target: "b", type: "inheritance" }], notes: [],
});

const relationshipToggle = "settings/relationTypeVisibilityToggled";
const editorReducer = withEditorHistory((state: {
  diagram: ReturnType<typeof diagramSlice.reducer>;
  settings: { hiddenRelationTypes: string[]; theme: "light"; style: StyleProfile };
} | undefined, action) => {
  const settings = state?.settings ?? { hiddenRelationTypes: [], theme: "light" as const, style: {} as StyleProfile };
  return {
    diagram: diagramSlice.reducer(state?.diagram, action),
    settings: action.type === relationshipToggle ? { ...settings, hiddenRelationTypes: ["inheritance"] } : settings,
  };
}, { ...diagramEditLabels, [relationshipToggle]: "Change relationship visibility" },
{ undo: undo.type, redo: redo.type, reset: loadSucceeded.type, theme: "settings/themeSet" });

test("hiding a selection is one undoable edit; new edits clear redo", () => {
  let state = editorReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  state = editorReducer(state, classesHidden(["a", "b"]));
  assert.ok(state.diagram.diagram!.classes.every((c) => c.hidden));
  state = editorReducer(state, routesUpdated([[]]));
  state = editorReducer(state, undo());
  assert.ok(state.diagram.diagram!.classes.every((c) => !c.hidden));
  assert.equal(state.diagram.saveStatus, "unsaved");
  state = editorReducer(state, redo());
  assert.ok(state.diagram.diagram!.classes.every((c) => c.hidden));
  state = editorReducer(state, undo());
  state = editorReducer(state, classVisibilityToggled("a"));
  assert.equal(editorReducer(state, redo()), state);
  state = editorReducer(state, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  assert.equal(editorReducer(state, undo()), state);
});

test("moving multiple nodes is one edit", () => {
  let state = editorReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  state = editorReducer(state, nodesMoved([{ id: "a", type: "umlClass", x: 20, y: 30 }, { id: "b", type: "umlClass", x: 40, y: 50 }]));
  state = editorReducer(state, undo());
  assert.deepEqual(state.diagram.diagram!.classes.map((c) => c.position.x), [0, 0]);
  state = editorReducer(state, redo());
  assert.deepEqual(state.diagram.diagram!.classes.map((c) => c.position.x), [20, 40]);
});

test("export location is remembered for the current project and reset on project change", () => {
  const diagramReducer = diagramSlice.reducer;
  let state = diagramReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: "/project", exportPath: "/output/diagram.typ" }));
  assert.equal(state.exportPath, "/output/diagram.typ");
  state = diagramReducer(state, exportPathChanged("/output/new.typ"));
  assert.equal(state.exportPath, "/output/new.typ");
  assert.equal(state.saveStatus, "unsaved");
  state = diagramReducer(state, loadSucceeded({ diagram: makeDiagram(), projectDir: "/other" }));
  assert.equal(state.exportPath, null);
});

test("relationship visibility and export preferences share history and report the restored edit", () => {
  let state = editorReducer(undefined, loadSucceeded({
    diagram: makeDiagram(), projectDir: "/project", exportPath: "original.typ", autoExport: false,
  }));
  state = editorReducer(state, { type: relationshipToggle });
  state = editorReducer(state, exportPathChanged("new.typ"));
  state = editorReducer(state, undo());
  assert.equal(state.diagram.exportPath, "original.typ");
  assert.equal(state.diagram.autoExport, false);
  assert.deepEqual(state.settings.hiddenRelationTypes, ["inheritance"]);
  state = editorReducer(state, undo());
  assert.deepEqual(state.settings.hiddenRelationTypes, []);
  assert.equal(state.history.notice?.text, "Undid change relationship visibility");
  state = editorReducer(state, redo());
  assert.deepEqual(state.settings.hiddenRelationTypes, ["inheritance"]);
  assert.equal(state.history.notice?.text, "Redid change relationship visibility");
});
