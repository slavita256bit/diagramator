import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { diagramSlice } from "@/entities/diagram";
import { settingsSlice } from "@/entities/settings";

const rootReducer = combineSlices(diagramSlice, settingsSlice);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
