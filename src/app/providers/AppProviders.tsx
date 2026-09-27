import { useMemo, type ReactNode } from "react";
import { Provider } from "react-redux";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { selectThemeMode } from "@/entities/settings";
import { useAppSelector } from "@/shared/model/hooks";
import { store } from "../store";

function ThemedApp({ children }: { children: ReactNode }) {
  const mode = useAppSelector(selectThemeMode);
  const theme = useMemo(
    () =>
      createTheme({
        palette: { mode, primary: { main: "#1e3a5f" }, secondary: { main: "#f2a541" } },
      }),
    [mode],
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemedApp>{children}</ThemedApp>
    </Provider>
  );
}
