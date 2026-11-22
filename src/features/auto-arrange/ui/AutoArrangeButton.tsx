import { IconButton, Tooltip } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import { selectDiagram } from "@/entities/diagram";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { selectSelectedClassIds } from "@/entities/settings";
import { autoArrange, autoArrangeSelected } from "../model/thunks";

/** Re-lays out all classes (layered by inheritance); resets manual positions. */
export function AutoArrangeButton() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const selected = useAppSelector(selectSelectedClassIds);
  return (
    <>
    <Tooltip title="Auto-arrange classes">
      <span>
        <IconButton color="inherit" disabled={!backend.available || !diagram} onClick={() => dispatch(autoArrange())}>
          <AutoFixHighIcon />
        </IconButton>
      </span>
    </Tooltip>
    <Tooltip title="Auto-arrange selected classes">
      <span>
        <IconButton color="inherit" aria-label="Auto-arrange selected classes" disabled={!backend.available || !diagram || selected.length < 2}
          onClick={() => dispatch(autoArrangeSelected())}>
          <SelectAllIcon />
        </IconButton>
      </span>
    </Tooltip>
    </>
  );
}
