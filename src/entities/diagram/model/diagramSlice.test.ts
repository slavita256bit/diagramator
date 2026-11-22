import { test } from "node:test";
import assert from "node:assert/strict";
import { classesHidden, classVisibilityToggled, diagramReducer, exportPathChanged, loadSucceeded, nodesMoved, redo, routesUpdated, undo } from "./diagramSlice.ts";
import type { Diagram } from "../../../shared/types/diagram.ts";

const makeDiagram = (): Diagram => ({
  classes: ["a", "b"].map((id) => ({ id, name: id, kind: "class", attributes: [], methods: [], templateParams: [],
    attributesCollapsed: false, methodsCollapsed: false, position: { x: 0, y: 0, width: 100, height: 80 } })),
  relations: [{ source: "a", target: "b", type: "inheritance" }], notes: [],
});

test("hiding a selection is one undoable edit; new edits clear redo", () => {
  let state = diagramReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  state = diagramReducer(state, classesHidden(["a", "b"]));
  assert.ok(state.diagram!.classes.every((c) => c.hidden));
  state = diagramReducer(state, routesUpdated([[]]));
  state = diagramReducer(state, undo());
  assert.ok(state.diagram!.classes.every((c) => !c.hidden));
  assert.equal(state.saveStatus, "unsaved");
  state = diagramReducer(state, redo());
  assert.ok(state.diagram!.classes.every((c) => c.hidden));
  state = diagramReducer(state, undo());
  state = diagramReducer(state, classVisibilityToggled("a"));
  assert.equal(diagramReducer(state, redo()), state);
  state = diagramReducer(state, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  assert.equal(diagramReducer(state, undo()), state);
});

test("moving multiple nodes is one edit", () => {
  let state = diagramReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: null }));
  state = diagramReducer(state, nodesMoved([{ id: "a", type: "umlClass", x: 20, y: 30 }, { id: "b", type: "umlClass", x: 40, y: 50 }]));
  state = diagramReducer(state, undo());
  assert.deepEqual(state.diagram!.classes.map((c) => c.position.x), [0, 0]);
  state = diagramReducer(state, redo());
  assert.deepEqual(state.diagram!.classes.map((c) => c.position.x), [20, 40]);
});

test("export location is remembered for the current project and reset on project change", () => {
  let state = diagramReducer(undefined, loadSucceeded({ diagram: makeDiagram(), projectDir: "/project", exportPath: "/output/diagram.typ" }));
  assert.equal(state.exportPath, "/output/diagram.typ");
  state = diagramReducer(state, exportPathChanged("/output/new.typ"));
  assert.equal(state.exportPath, "/output/new.typ");
  assert.equal(state.saveStatus, "unsaved");
  state = diagramReducer(state, loadSucceeded({ diagram: makeDiagram(), projectDir: "/other" }));
  assert.equal(state.exportPath, null);
});
