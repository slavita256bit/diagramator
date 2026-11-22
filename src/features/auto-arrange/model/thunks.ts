import { diagramArranged, sizeDiagram } from "@/entities/diagram";
import { backend } from "@/shared/api";
import type { AppThunk } from "@/shared/model/hooks";
import { spaceLayout } from "./selectedLayout";

/** Re-lays out the current diagram (layered by inheritance), discarding manual positions. */
export const autoArrange = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram } = getState().diagram;
  if (!diagram || !backend.available) return;
  const relaid = await backend.autoArrange(diagram);
  dispatch(diagramArranged(sizeDiagram(relaid, getState().settings.style)));
};

/** Lay out only selected classes and leave all other diagram objects untouched. */
export const autoArrangeSelected = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const { diagram } = getState().diagram;
  if (!diagram || !backend.available) return;
  const ids = new Set(getState().settings.selectedClassIds);
  const selected = diagram.classes.filter((c) => ids.has(c.id) && !c.hidden);
  if (selected.length < 2) return;
  const subset = { classes: selected, relations: diagram.relations.filter((r) => ids.has(r.source) && ids.has(r.target)), notes: [] };
  const arranged = sizeDiagram(await backend.autoArrange(subset), getState().settings.style);
  arranged.classes = spaceLayout(arranged.classes);
  // Do not overwrite edits made while the layout was computed.
  if (getState().diagram.diagram !== diagram) return;
  const originalX = Math.min(...selected.map((c) => c.position.x));
  const originalY = Math.min(...selected.map((c) => c.position.y));
  const layoutX = Math.min(...arranged.classes.map((c) => c.position.x));
  const layoutY = Math.min(...arranged.classes.map((c) => c.position.y));
  let dx = originalX - layoutX;
  const dy = originalY - layoutY;
  const fixed = [...diagram.classes.filter((c) => !ids.has(c.id) && !c.hidden), ...diagram.notes];
  const overlaps = () => arranged.classes.some((a) => fixed.some((b) =>
    a.position.x + dx < b.position.x + b.position.width + 20 && a.position.x + dx + a.position.width + 20 > b.position.x &&
    a.position.y + dy < b.position.y + b.position.height + 20 && a.position.y + dy + a.position.height + 20 > b.position.y));
  if (fixed.length && overlaps()) dx = Math.max(...fixed.map((c) => c.position.x + c.position.width)) + 20 - layoutX;
  const positions = new Map(arranged.classes.map((c) => [c.id, { x: c.position.x + dx, y: c.position.y + dy }]));
  dispatch(diagramArranged({ ...diagram, classes: diagram.classes.map((c) => {
    const position = positions.get(c.id);
    return position ? { ...c, position: { ...c.position, ...position } } : c;
  }) }));
};
