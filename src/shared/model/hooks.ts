import { useDispatch, useSelector } from "react-redux";
import type { ThunkAction, UnknownAction } from "@reduxjs/toolkit";
// Type-only import from the app layer: the standard FSD exception for store typing.
import type { AppDispatch, RootState } from "@/app/store";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export type AppThunk<R = void> = ThunkAction<R, RootState, unknown, UnknownAction>;
