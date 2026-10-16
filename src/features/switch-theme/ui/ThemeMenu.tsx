import { useState } from "react";
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from "@mui/material";
import ContrastIcon from "@mui/icons-material/Contrast";
import CheckIcon from "@mui/icons-material/Check";
import { selectTheme, themeSet } from "@/entities/settings";
import { APP_THEMES, type AppThemeId } from "@/shared/config";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

/** App (UI chrome) theme picker. Diagram colors come from the style profile instead. */
export function ThemeMenu() {
  const dispatch = useAppDispatch();
  const current = useAppSelector(selectTheme);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="App theme">
        <IconButton aria-label="App theme" color="inherit" onClick={(e) => setAnchor(e.currentTarget)}>
          <ContrastIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {(Object.entries(APP_THEMES) as [AppThemeId, (typeof APP_THEMES)[AppThemeId]][]).map(([id, t]) => (
          <MenuItem
            key={id}
            selected={id === current}
            onClick={() => {
              dispatch(themeSet(id));
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: 1,
                  borderColor: "divider",
                  background: `linear-gradient(135deg, ${t.appBar} 50%, ${t.primary} 50%)`,
                }}
              />
            </ListItemIcon>
            <ListItemText primary={t.name} />
            {id === current && <CheckIcon fontSize="small" sx={{ ml: 2 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
