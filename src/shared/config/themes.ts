import type { PaletteMode } from "@mui/material";

export interface AppTheme {
  name: string;
  mode: PaletteMode;
  primary: string;
  secondary: string;
  background: string;
  paper: string;
  /** Toolbar background. */
  appBar: string;
  /** Diagram page behind the class boxes. Always light-ish: diagram styles are print colors. */
  canvas: string;
  canvasDots: string;
  text?: string;
}

export const APP_THEMES = {
  light: {
    name: "Light",
    mode: "light",
    primary: "#1f5fae",
    secondary: "#f2a541",
    background: "#f4f6f9",
    paper: "#ffffff",
    appBar: "#1e3a5f",
    canvas: "#fbfcfd",
    canvasDots: "#c3c9d2",
  },
  dark: {
    name: "Dark",
    mode: "dark",
    primary: "#8ab4ff",
    secondary: "#f2b25c",
    background: "#15171b",
    paper: "#1e2127",
    appBar: "#1a1d22",
    canvas: "#e8eaee",
    canvasDots: "#b9bec6",
  },
  nord: {
    name: "Nord",
    mode: "dark",
    primary: "#88c0d0",
    secondary: "#ebcb8b",
    background: "#2e3440",
    paper: "#3b4252",
    appBar: "#2e3440",
    canvas: "#eceff4",
    canvasDots: "#c2c8d3",
    text: "#eceff4",
  },
  solarized: {
    name: "Solarized",
    mode: "light",
    primary: "#268bd2",
    secondary: "#cb4b16",
    background: "#eee8d5",
    paper: "#fdf6e3",
    appBar: "#073642",
    canvas: "#fdf6e3",
    canvasDots: "#d6ceb5",
    text: "#073642",
  },
} satisfies Record<string, AppTheme>;

export type AppThemeId = keyof typeof APP_THEMES;

export const isAppThemeId = (v: unknown): v is AppThemeId => typeof v === "string" && Object.hasOwn(APP_THEMES, v);
