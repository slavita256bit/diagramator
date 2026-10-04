import { IconButton, Tooltip } from "@mui/material";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import { selectDiagram } from "@/entities/diagram";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { addNote } from "../model/thunks";

/** Drops a freestanding comment box onto the canvas. */
export function AddNoteButton() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  return (
    <Tooltip title="Add comment">
      <span>
        <IconButton color="inherit" disabled={!diagram} onClick={() => dispatch(addNote())}>
          <NoteAddIcon />
        </IconButton>
      </span>
    </Tooltip>
  );
}
