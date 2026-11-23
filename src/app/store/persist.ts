import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { persistSettings, recentOpened, recentRemoved, styleSet, themeSet } from "@/entities/settings";
import { redo, undo } from "@/entities/diagram";
import type { AppDispatch, RootState } from "./index";

/** Mirror settings (style, recent projects, theme) into localStorage. */
export const persist = createListenerMiddleware();

persist.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(styleSet, recentOpened, recentRemoved, themeSet, undo, redo),
  effect: (_, api) => persistSettings(api.getState().settings),
});
