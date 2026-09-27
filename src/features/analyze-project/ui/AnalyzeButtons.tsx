import { Button, CircularProgress, Stack } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DataObjectIcon from "@mui/icons-material/DataObject";
import { selectStatus } from "@/entities/diagram";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { analyzeProject, openDoxygenXml } from "../model/thunks";

export function AnalyzeButtons() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector(selectStatus) === "loading";
  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="contained"
        color="secondary"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FolderOpenIcon />}
        onClick={() => dispatch(analyzeProject())}
      >
        Analyze sources
      </Button>
      <Button
        color="inherit"
        disabled={loading}
        startIcon={<DataObjectIcon />}
        onClick={() => dispatch(openDoxygenXml())}
      >
        Open Doxygen XML
      </Button>
    </Stack>
  );
}
