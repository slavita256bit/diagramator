import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StyleProfile } from "@/shared/types";
import { normalizeStyle } from "@/shared/config";

export type ThemeMode = "light" | "dark";

export interface RecentProject {
  path: string;
  openedAt: number;
}

export interface SettingsState {
  themeMode: ThemeMode;
  /** Style for new projects; a project's own style (from `diagramator.json`) replaces it on open. */
  style: StyleProfile;
  /** Most recent first. */
  recent: RecentProject[];
}

const MAX_RECENT = 10;
const STORAGE_KEY = { style: "diagramator.style", recent: "diagramator.recent" };

function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

/** Called by the app's persist listener. */
export function persistSettings(s: SettingsState) {
  try {
    localStorage.setItem(STORAGE_KEY.style, JSON.stringify(s.style));
    localStorage.setItem(STORAGE_KEY.recent, JSON.stringify(s.recent));
  } catch {
    /* storage unavailable: settings just aren't remembered */
  }
}

const initialState: SettingsState = {
  themeMode: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  style: normalizeStyle(read<Partial<StyleProfile>>(STORAGE_KEY.style)),
  recent: (read<RecentProject[]>(STORAGE_KEY.recent) ?? []).filter((r) => typeof r?.path === "string"),
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
    recentOpened(state, action: PayloadAction<string>) {
      state.recent = [
        { path: action.payload, openedAt: Date.now() },
        ...state.recent.filter((r) => r.path !== action.payload),
      ].slice(0, MAX_RECENT);
    },
    recentRemoved(state, action: PayloadAction<string>) {
      state.recent = state.recent.filter((r) => r.path !== action.payload);
    },
  },
  selectors: {
    selectThemeMode: (s) => s.themeMode,
    selectStyle: (s) => s.style,
    selectRecent: (s) => s.recent,
  },
});

export const { themeToggled, styleSet, recentOpened, recentRemoved } = settingsSlice.actions;
export const { selectThemeMode, selectStyle, selectRecent } = settingsSlice.selectors;
