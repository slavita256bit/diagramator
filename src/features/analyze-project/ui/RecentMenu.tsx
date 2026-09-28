import { useState } from "react";
import {
  Button,
  Divider,
  IconButton,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import { recentRemoved, selectRecent } from "@/entities/settings";
import { backend } from "@/shared/api";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import { openExample, openProject } from "../model/thunks";

const baseName = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p;

/** Recent projects (removable) and bundled examples. */
export function RecentMenu() {
  const dispatch = useAppDispatch();
  const recent = useAppSelector(selectRecent);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [examples, setExamples] = useState<{ name: string }[]>([]);

  const open = (el: HTMLElement) => {
    setAnchor(el);
    backend.listExamples().then(setExamples).catch(() => setExamples([]));
  };
  const close = () => setAnchor(null);

  return (
    <>
      <Button
        color="inherit"
        startIcon={<HistoryIcon />}
        disabled={!backend.available}
        onClick={(e) => open(e.currentTarget)}
      >
        Open
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} slotProps={{ paper: { sx: { maxWidth: 520 } } }}>
        <ListSubheader>Recent projects</ListSubheader>
        {recent.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="Nothing yet" />
          </MenuItem>
        )}
        {recent.map((r) => (
          <MenuItem
            key={r.path}
            onClick={() => {
              close();
              dispatch(openProject(r.path));
            }}
          >
            <ListItemText
              primary={baseName(r.path)}
              secondary={r.path}
              slotProps={{ secondary: { noWrap: true, title: r.path } }}
            />
            <Tooltip title="Remove from list">
              <IconButton
                size="small"
                edge="end"
                sx={{ ml: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(recentRemoved(r.path));
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </MenuItem>
        ))}
        <Divider />
        <ListSubheader>Examples</ListSubheader>
        {examples.map((ex) => (
          <MenuItem
            key={ex.name}
            onClick={() => {
              close();
              dispatch(openExample(ex.name));
            }}
          >
            <ListItemText primary={ex.name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
