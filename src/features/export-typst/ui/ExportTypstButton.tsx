import { Button } from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import { loadFailed, selectDiagram } from "@/entities/diagram";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { exportTypst } from "../model/thunks";

export function ExportTypstButton() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  return (
    <Button
      color="inherit"
      disabled={!diagram || !backend.available}
      startIcon={<DescriptionIcon />}
      onClick={() => dispatch(exportTypst()).catch((e) => dispatch(loadFailed(String(e))))}
    >
      Export Typst
    </Button>
  );
}
