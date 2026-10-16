import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { StyleProfile } from "@/shared/types";
import { isAppThemeId, normalizeStyle, type AppThemeId } from "@/shared/config";


export interface RecentProject {
  path: string;
  openedAt: number;
}

export interface SettingsState {
  theme: AppThemeId;
  /** Style for new projects; a project's own style (from `diagramator.json`) replaces it on open. */
  style: StyleProfile;
  /** Most recent first. */
  recent: RecentProject[];
}

const MAX_RECENT = 10;
const STORAGE_KEY = { style: "diagramator.style", recent: "diagramator.recent", theme: "diagramator.theme" };

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
    localStorage.setItem(STORAGE_KEY.theme, JSON.stringify(s.theme));
  } catch {
    /* storage unavailable: settings just aren't remembered */
  }
}

const initialState: SettingsState = {
  theme: (() => {
    const saved = read<string>(STORAGE_KEY.theme);
    if (isAppThemeId(saved)) return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  })(),
  style: normalizeStyle(read<Partial<StyleProfile>>(STORAGE_KEY.style)),
  recent: (read<RecentProject[]>(STORAGE_KEY.recent) ?? []).filter((r) => typeof r?.path === "string"),
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    themeSet(state, action: PayloadAction<AppThemeId>) {
      state.theme = action.payload;
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
    selectTheme: (s) => s.theme,
    selectStyle: (s) => s.style,
    selectRecent: (s) => s.recent,
  },
});

export const { themeSet, styleSet, recentOpened, recentRemoved } = settingsSlice.actions;
export const { selectTheme, selectStyle, selectRecent } = settingsSlice.selectors;
