import { useState } from "react";
import { AppBar, Box, IconButton, Toolbar, Tooltip, Typography } from "@mui/material";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import PaletteIcon from "@mui/icons-material/Palette";
import { AppUpdateDialog } from "@/features/app-update";
import { StyleDrawer } from "@/features/edit-style";
import { ExportTypstButton } from "@/features/export-typst";
import { SaveButton } from "@/features/save-project";
import { AnalyzeButtons, RecentMenu } from "@/features/analyze-project";
import { ToolStatusChips } from "@/features/tool-status";
import { selectSource } from "@/entities/diagram";
import { selectThemeMode, themeToggled } from "@/entities/settings";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

export function AppToolbar() {
  const dispatch = useAppDispatch();
  const source = useAppSelector(selectSource);
  const mode = useAppSelector(selectThemeMode);
  const [styleOpen, setStyleOpen] = useState(false);
  return (
    <AppBar position="static" elevation={0}>
      <Toolbar
        variant="dense"
        sx={{
          gap: 2,
          flexWrap: "wrap",
          rowGap: 1,
          py: 1,
          "& .MuiButton-root, & .MuiChip-root": { whiteSpace: "nowrap" },
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, flexShrink: 0 }}>
          Diagramator
        </Typography>
        <AnalyzeButtons />
        <RecentMenu />
        <SaveButton />
        <ExportTypstButton />
        <Typography variant="body2" noWrap sx={{ opacity: 0.8, flex: 1, minWidth: 100 }} title={source ?? ""}>
          {source}
        </Typography>
        <ToolStatusChips />
        <Box sx={{ flexShrink: 0 }}>
          <Tooltip title="Diagram style">
            <IconButton color="inherit" onClick={() => setStyleOpen(true)}>
              <PaletteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Toggle theme">
            <IconButton color="inherit" onClick={() => dispatch(themeToggled())}>
              {mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
      <StyleDrawer open={styleOpen} onClose={() => setStyleOpen(false)} />
      <AppUpdateDialog />
    </AppBar>
  );
}
