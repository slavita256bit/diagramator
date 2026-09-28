import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StyleProfile } from "@/shared/types";
import { normalizeStyle } from "@/shared/config";

export type ThemeMode = "light" | "dark";

export interface SettingsState {
  themeMode: ThemeMode;
  style: StyleProfile;
}

const STYLE_KEY = "diagramator.style";

function loadStyle(): StyleProfile {
  try {
    return normalizeStyle(JSON.parse(localStorage.getItem(STYLE_KEY) ?? "null"));
  } catch {
    return normalizeStyle(null);
  }
}

/** Remember the last used style until it lives in the project file (PLAN.md phase 6). */
export function saveStyle(style: StyleProfile) {
  try {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style));
  } catch {
    /* storage unavailable: style just isn't remembered */
  }
}

const initialState: SettingsState = {
  themeMode: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  style: loadStyle(),
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    themeToggled(state) {
      state.themeMode = state.themeMode === "dark" ? "light" : "dark";
    },
    styleSet(state, action: PayloadAction<StyleProfile>) {
      state.style = action.payload;
    },
  },
  selectors: {
    selectThemeMode: (s) => s.themeMode,
    selectStyle: (s) => s.style,
  },
});

export const { themeToggled, styleSet } = settingsSlice.actions;
export const { selectThemeMode, selectStyle } = settingsSlice.selectors;
