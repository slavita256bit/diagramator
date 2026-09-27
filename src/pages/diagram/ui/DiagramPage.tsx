import { useEffect } from "react";
import { Alert, Box, Snackbar } from "@mui/material";
import { AppToolbar } from "@/widgets/toolbar";
import { DiagramCanvas } from "@/widgets/diagram-canvas";
import { analyzeProject } from "@/features/analyze-project";
import { errorDismissed, selectError } from "@/entities/diagram";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

export function DiagramPage() {
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);

  // Outside Tauri there is no backend: show the sample diagram right away.
  useEffect(() => {
    if (!backend.available) dispatch(analyzeProject());
  }, [dispatch]);
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
