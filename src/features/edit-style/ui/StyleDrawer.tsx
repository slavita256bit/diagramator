import {
  Box,
  Button,
  Drawer,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { loadFailed } from "@/entities/diagram";
import { selectStyle } from "@/entities/settings";
import { backend } from "@/shared/api";
import { FONT_CHOICES, STYLE_PRESETS } from "@/shared/config";
import { useAppDispatch, useAppSelector } from "@/shared/model/hooks";
import type { StyleColors, StyleProfile } from "@/shared/types";
import { applyStyle, exportStyle, importStyle } from "../model/thunks";

type NumberKey = {
  [K in keyof StyleProfile]: StyleProfile[K] extends number ? K : never;
}[keyof StyleProfile];

const NUMBERS: [NumberKey, string][] = [
  ["fontSize", "Font size"],
  ["nameFontSize", "Name size"],
  ["stereotypeFontSize", "Stereotype size"],
  ["lineHeight", "Line height"],
  ["paddingX", "Padding X"],
  ["paddingY", "Padding Y"],
  ["borderWidth", "Border width"],
  ["cornerRadius", "Corner radius"],
  ["edgeWidth", "Edge width"],
  ["arrowSize", "Arrow size"],
  ["edgeDashLength", "Dash length"],
  ["edgeDashGap", "Dash gap"],
];

const MEMBER_ICON_STYLES: [StyleProfile["memberIconStyle"], string][] = [
  ["text", "+/-/# text"],
  ["shape", "Shape by access (VS)"],
  ["circle", "Colored circle (PlantUML)"],
];

const TEMPLATE_NOTATIONS: [StyleProfile["templateNotation"], string][] = [
  ["corner", "Dashed corner box (GOST)"],
  ["header", "template<...> header row"],
  ["none", "Don't mark templates"],
];

const COLORS: [keyof StyleColors, string][] = [
  ["text", "Text"],
  ["border", "Border"],
  ["fill", "Fill"],
  ["headerFill", "Header"],
  ["edge", "Edges"],
  ["badge", "Badge"],
];

/** Style profile editor: presets, font, metrics, colors, import/export. */
export function StyleDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const style = useAppSelector(selectStyle);
  const set = (patch: Partial<StyleProfile>) => dispatch(applyStyle({ ...style, ...patch }));
  const fail = (e: unknown) => dispatch(loadFailed(String(e)));
  const fontKey =
    Object.entries(FONT_CHOICES).find(([, list]) => list[0] === style.font[0])?.[0] ?? "";

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 320, p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Style</Typography>
          <TextField
            select
            size="small"
            label="Preset"
            value=""
            onChange={(e) => dispatch(applyStyle(STYLE_PRESETS[e.target.value]))}
            helperText={`Current: ${style.name}`}
          >
            {Object.entries(STYLE_PRESETS).map(([key, p]) => (
              <MenuItem key={key} value={key}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Name" value={style.name} onChange={(e) => set({ name: e.target.value })} />
          <TextField
            select
            size="small"
            label="Font"
            value={fontKey}
            onChange={(e) => set({ font: FONT_CHOICES[e.target.value] })}
          >
            {Object.keys(FONT_CHOICES).map((f) => (
              <MenuItem key={f} value={f} sx={{ fontFamily: `"${f}"` }}>
                {f}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            {NUMBERS.map(([key, label]) => (
              <TextField
                key={key}
                size="small"
                type="number"
                label={label}
                value={style[key]}
                slotProps={{ htmlInput: { min: 0, step: 0.5 } }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0) set({ [key]: v });
                }}
              />
            ))}
          </Box>
          <Box>
            <FormControlLabel
              control={<Switch checked={style.nameBold} onChange={(e) => set({ nameBold: e.target.checked })} />}
              label="Bold class name"
            />
            <FormControlLabel
              control={<Switch checked={style.kindBadge} onChange={(e) => set({ kindBadge: e.target.checked })} />}
              label="Kind badge (C/I/E)"
            />
            <FormControlLabel
              control={<Switch checked={style.showStereotype} onChange={(e) => set({ showStereotype: e.target.checked })} />}
              label="Stereotype («interface» etc.)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={style.interfaceHidesAttributes}
                  onChange={(e) => set({ interfaceHidesAttributes: e.target.checked })}
                />
              }
              label="Interfaces hide attributes (GOST)"
            />
            <FormControlLabel
              control={
                <Switch checked={style.orthogonalEdges} onChange={(e) => set({ orthogonalEdges: e.target.checked })} />
              }
              label="Orthogonal edges (90° only)"
            />
          </Box>

          <Typography variant="subtitle2">Members</Typography>
          <TextField
            select
            size="small"
            label="Member icon"
            value={style.memberIconStyle}
            onChange={(e) => set({ memberIconStyle: e.target.value as StyleProfile["memberIconStyle"] })}
          >
            {MEMBER_ICON_STYLES.map(([v, label]) => (
              <MenuItem key={v} value={v}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Box>
            <FormControlLabel
              control={
                <Switch checked={style.showMethodParams} onChange={(e) => set({ showMethodParams: e.target.checked })} />
              }
              label="Show method parameters"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={style.showMethodReturnType}
                  onChange={(e) => set({ showMethodReturnType: e.target.checked })}
                />
              }
              label="Show method return type"
            />
          </Box>

          <Typography variant="subtitle2">Templates</Typography>
          <TextField
            select
            size="small"
            label="Template notation"
            value={style.templateNotation}
            onChange={(e) => set({ templateNotation: e.target.value as StyleProfile["templateNotation"] })}
          >
            {TEMPLATE_NOTATIONS.map(([v, label]) => (
              <MenuItem key={v} value={v}>
                {label}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="subtitle2">Colors</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
            {COLORS.map(([key, label]) => (
              <Box key={key} component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: 13 }}>
                <input
                  type="color"
                  value={style.colors[key]}
                  onChange={(e) => set({ colors: { ...style.colors, [key]: e.target.value } })}
                />
                {label}
              </Box>
            ))}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<FileUploadIcon />}
              disabled={!backend.available}
              onClick={() => dispatch(importStyle()).catch(fail)}
            >
              Import
            </Button>
            <Button
              startIcon={<FileDownloadIcon />}
              disabled={!backend.available}
              onClick={() => dispatch(exportStyle()).catch(fail)}
            >
              Export
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
