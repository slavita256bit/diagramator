import { noteAdded } from "@/entities/diagram";
import type { AppThunk } from "@/shared/model/hooks";

let counter = 0;
const newNoteId = () => `note-${Date.now()}-${counter++}`;

/** Drops a new freestanding comment box near the top-left of the diagram (GOST fig 4.5). */
export const addNote = (): AppThunk => (dispatch, getState) => {
  const diagram = getState().diagram.diagram;
  if (!diagram) return;
  const x = Math.min(0, ...diagram.classes.map((c) => c.position.x)) - 220;
  const y = Math.min(0, ...diagram.classes.map((c) => c.position.y));
  dispatch(noteAdded({ id: newNoteId(), text: "", position: { x, y, width: 180, height: 90 } }));
};
