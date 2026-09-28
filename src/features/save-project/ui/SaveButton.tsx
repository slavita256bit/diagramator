import { useEffect } from "react";
import { Button, CircularProgress } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { selectProjectDir, selectSaveStatus } from "@/entities/diagram";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { saveProject } from "../model/thunks";

const LABEL = { saved: "Saved", unsaved: "Save", saving: "Saving…", failed: "Retry save" } as const;

/** Save button + Ctrl/Cmd+S. Edits are also autosaved (see `app/store/autosave.ts`). */
export function SaveButton() {
  const dispatch = useAppDispatch();
  const dir = useAppSelector(selectProjectDir);
  const status = useAppSelector(selectSaveStatus);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        dispatch(saveProject());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  if (!dir) return null;
  return (
    <Button
      color="inherit"
      title={`diagramator.json + diagram.typ in ${dir}`}
      startIcon={status === "saving" ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
      disabled={status === "saving"}
      onClick={() => dispatch(saveProject())}
    >
      {LABEL[status]}
    </Button>
  );
}
