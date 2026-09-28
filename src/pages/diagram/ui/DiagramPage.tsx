import { useEffect } from "react";
import { Alert, Box, Snackbar } from "@mui/material";
import { AppToolbar } from "@/widgets/toolbar";
import { DiagramCanvas } from "@/widgets/diagram-canvas";
import { analyzeProject, openProject } from "@/features/analyze-project";
import { errorDismissed, selectError } from "@/entities/diagram";
import { selectRecent } from "@/entities/settings";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

let startedUp = false;

export function DiagramPage() {
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);

  const latest = useAppSelector(selectRecent)[0]?.path;

  // Once per app start: reopen the latest project; outside Tauri show the sample diagram.
  useEffect(() => {
    if (startedUp) return; // StrictMode runs effects twice in dev
    startedUp = true;
    if (!backend.available) dispatch(analyzeProject());
    else if (latest) dispatch(openProject(latest));
  }, [dispatch, latest]);
  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <AppToolbar />
      <DiagramCanvas />
      <Snackbar open={!!error} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" variant="filled" onClose={() => dispatch(errorDismissed())} sx={{ whiteSpace: "pre-wrap", maxWidth: 720 }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
