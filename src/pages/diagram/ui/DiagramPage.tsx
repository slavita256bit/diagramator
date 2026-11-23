import { useEffect, useState } from "react";
import { Alert, Box, Snackbar } from "@mui/material";
import { AppToolbar } from "@/widgets/toolbar";
import { DiagramCanvas } from "@/widgets/diagram-canvas";
import { analyzeProject, openProject } from "@/features/analyze-project";
import { errorDismissed, selectError } from "@/entities/diagram";
import { selectRecent } from "@/entities/settings";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { FlowchartEditor } from "@/widgets/flowchart-editor";

let startedUp = false;

export function DiagramPage() {
  const dispatch = useAppDispatch();
  const error = useAppSelector(selectError);
  const notice = useAppSelector((state) => state.history.notice);
  const [dismissedNotice, dismissNotice] = useState<typeof notice>(null);
  const [mode, setMode] = useState<"class" | "flowchart">("class");

  const latest = useAppSelector(selectRecent)[0]?.path;

  useEffect(() => {
    // Canvas handlers consume the gesture first. Suppress the webview's page zoom.
    const wheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); };
    const gesture = (event: Event) => event.preventDefault();
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) event.preventDefault();
    };
    window.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("gesturestart", gesture, { passive: false });
    window.addEventListener("gesturechange", gesture, { passive: false });
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("gesturestart", gesture);
      window.removeEventListener("gesturechange", gesture);
      window.removeEventListener("keydown", key);
    };
  }, []);

  // Once per app start: reopen the latest project; outside Tauri show the sample diagram.
  useEffect(() => {
    if (startedUp) return; // StrictMode runs effects twice in dev
    startedUp = true;
    if (!backend.available) dispatch(analyzeProject());
    else if (latest) dispatch(openProject(latest));
  }, [dispatch, latest]);
  return (
    <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {mode === "class" && <AppToolbar onSwitchMode={() => setMode("flowchart")} />}
      <Box sx={{ display: mode === "class" ? "flex" : "none", flex: 1, minHeight: 0 }}>
        <DiagramCanvas active={mode === "class"} />
      </Box>
      <Box sx={{ display: mode === "flowchart" ? "flex" : "none", flex: 1, minHeight: 0, flexDirection: "column" }}>
        <FlowchartEditor active={mode === "flowchart"} onSwitchMode={() => setMode("class")} />
      </Box>
      <Snackbar open={!!error} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="error" variant="filled" onClose={() => dispatch(errorDismissed())} sx={{ whiteSpace: "pre-wrap", maxWidth: 720 }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        key={notice?.id}
        open={!!notice && notice !== dismissedNotice}
        message={notice?.text}
        autoHideDuration={2000}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={(_, reason) => { if (reason !== "clickaway") dismissNotice(notice); }}
        sx={{ "& .MuiSnackbarContent-root": { minWidth: 0 } }}
      />
    </Box>
  );
}
