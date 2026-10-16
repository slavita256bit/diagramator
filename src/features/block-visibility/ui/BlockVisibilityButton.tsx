import { useState } from "react";
import { Badge, Box, Checkbox, Drawer, IconButton, List, ListItemButton, ListItemText, TextField, Tooltip, Typography } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import { classVisibilityToggled, selectDiagram } from "@/entities/diagram";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";

export function BlockVisibilityButton() {
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectDiagram);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const hiddenCount = diagram?.classes.filter((c) => c.hidden).length ?? 0;
  return (
    <>
      <Tooltip title="Block visibility">
        <span>
          <IconButton color="inherit" aria-label="Block visibility" disabled={!diagram} onClick={() => setOpen(true)}>
            <Badge badgeContent={hiddenCount} color="warning"><VisibilityIcon /></Badge>
          </IconButton>
        </span>
      </Tooltip>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 340, maxWidth: "100vw", p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="h6">Block visibility</Typography>
            <IconButton aria-label="Close block visibility" onClick={() => setOpen(false)}><CloseIcon /></IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Hidden blocks and their relations are omitted from the canvas and export. Check a block to show it again.
          </Typography>
          <TextField label="Find block" size="small" fullWidth value={search} onChange={(e) => setSearch(e.target.value)} />
          <List>
            {diagram?.classes.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())).map((cls) => (
              <ListItemButton key={cls.id} onClick={() => dispatch(classVisibilityToggled(cls.id))}>
                <Checkbox checked={!cls.hidden} tabIndex={-1} disableRipple slotProps={{ input: { "aria-label": `Show ${cls.name}` } }} />
                <ListItemText primary={cls.name} secondary={cls.hidden ? "Hidden" : undefined} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
}
