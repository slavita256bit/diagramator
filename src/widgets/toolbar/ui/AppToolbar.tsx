import { useState } from "react";
import { AppBar, Box, Button, Checkbox, IconButton, ListItemText, Menu, MenuItem, Toolbar, Tooltip, Typography } from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { BlockVisibilityButton } from "@/features/block-visibility";
import { AddNoteButton } from "@/features/add-note";
import { AppUpdateDialog } from "@/features/app-update";
import { AutoArrangeButton } from "@/features/auto-arrange";
import { StyleDrawer } from "@/features/edit-style";
import { ExportTypstButton } from "@/features/export-typst";
import { SaveButton } from "@/features/save-project";
import { AnalyzeButtons, RecentMenu } from "@/features/analyze-project";
import { ToolStatusChips } from "@/features/tool-status";
import { selectSource } from "@/entities/diagram";
import { ThemeMenu } from "@/features/switch-theme";
import { relationTypeVisibilityToggled, selectHiddenRelationTypes } from "@/entities/settings";
import type { RelationType } from "@/shared/types";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

export function AppToolbar({ onSwitchMode }: { onSwitchMode: () => void }) {
  const source = useAppSelector(selectSource);
  const dispatch = useAppDispatch();
  const hiddenTypes = useAppSelector(selectHiddenRelationTypes);
  const [relationsMenu, setRelationsMenu] = useState<HTMLElement | null>(null);
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
        <Button color="inherit" onClick={onSwitchMode} aria-label="Switch to block-scheme editor" sx={{ fontSize: "1.25rem", fontWeight: 700, textTransform: "none", flexShrink: 0 }}>
          Diagramator
        </Button>
        <AnalyzeButtons />
        <RecentMenu />
        <SaveButton />
        <ExportTypstButton />
        <Typography variant="body2" noWrap sx={{ opacity: 0.8, flex: 1, minWidth: 100 }} title={source ?? ""}>
          {source}
        </Typography>
        <ToolStatusChips />
        <Box sx={{ flexShrink: 0 }}>
          <AutoArrangeButton />
          <AddNoteButton />
          <BlockVisibilityButton />
          <Tooltip title="Relationship visibility">
            <IconButton color="inherit" aria-label="Relationship visibility" onClick={(e) => setRelationsMenu(e.currentTarget)}>
              <AccountTreeIcon />
            </IconButton>
          </Tooltip>
          <Menu anchorEl={relationsMenu} open={!!relationsMenu} onClose={() => setRelationsMenu(null)}>
            {(["inheritance", "realization", "composition", "aggregation", "association", "dependency"] as RelationType[]).map((type) => (
              <MenuItem key={type} onClick={() => dispatch(relationTypeVisibilityToggled(type))}>
                <Checkbox checked={!hiddenTypes.includes(type)} />
                <ListItemText primary={type[0].toUpperCase() + type.slice(1)}
                  secondary={type === "realization" ? "Implements an interface · dashed" : type === "dependency" ? "Uses another class · dashed" : undefined} />
              </MenuItem>
            ))}
          </Menu>
          <Tooltip title="Diagram style">
            <IconButton color="inherit" onClick={() => setStyleOpen(true)}>
              <PaletteIcon />
            </IconButton>
          </Tooltip>
          <ThemeMenu />
        </Box>
      </Toolbar>
      <StyleDrawer open={styleOpen} onClose={() => setStyleOpen(false)} />
      <AppUpdateDialog />
    </AppBar>
  );
}
