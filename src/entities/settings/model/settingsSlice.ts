import { createSlice } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark";

export interface SettingsState {
  themeMode: ThemeMode;
}

const initialState: SettingsState = {
  themeMode: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    themeToggled(state) {
      state.themeMode = state.themeMode === "dark" ? "light" : "dark";
    },
  },
  selectors: {
    selectThemeMode: (s) => s.themeMode,
  },
});

export const { themeToggled } = settingsSlice.actions;
export const { selectThemeMode } = settingsSlice.selectors;
