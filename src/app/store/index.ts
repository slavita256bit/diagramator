import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { diagramReducer } from "@/entities/diagram";
import { settingsSlice } from "@/entities/settings";
import { autosave } from "./autosave";
import { routing } from "./routing";
import { persist } from "./persist";

const rootReducer = combineReducers({ diagram: diagramReducer, settings: settingsSlice.reducer });

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefault) => getDefault().prepend(routing.middleware, autosave.middleware, persist.middleware),
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
