import { createListenerMiddleware, isAnyOf } from "@reduxjs/toolkit";
import { persistSettings, recentOpened, recentRemoved, styleSet } from "@/entities/settings";
import type { AppDispatch, RootState } from "./index";

/** Mirror settings (style, recent projects) into localStorage. */
export const persist = createListenerMiddleware();

persist.startListening.withTypes<RootState, AppDispatch>()({
  matcher: isAnyOf(styleSet, recentOpened, recentRemoved),
  effect: (_, api) => persistSettings(api.getState().settings),
});
