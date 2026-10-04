import { IconButton, Tooltip } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import { selectDiagram } from "@/entities/diagram";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { autoArrange } from "../model/thunks";

/** Re-lays out all classes (layered by inheritance); resets manual positions. */
export function AutoArrangeButton() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  return (
    <Tooltip title="Auto-arrange classes">
      <span>
        <IconButton color="inherit" disabled={!backend.available || !diagram} onClick={() => dispatch(autoArrange())}>
          <AutoFixHighIcon />
        </IconButton>
      </span>
    </Tooltip>
  );
}
