import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { diagramSlice } from "@/entities/diagram";
import { settingsSlice } from "@/entities/settings";
import { autosave } from "./autosave";
import { routing } from "./routing";
import { persist } from "./persist";

const rootReducer = combineSlices(diagramSlice, settingsSlice);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().prepend(routing.middleware, autosave.middleware, persist.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
