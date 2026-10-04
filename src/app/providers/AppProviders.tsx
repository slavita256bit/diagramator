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
        // `primary` is used as plain text color too (e.g. text-variant buttons), so it needs
        // a lighter shade in dark mode — the light-mode navy is nearly invisible on a dark
        // background otherwise.
        palette: {
          mode,
          primary: { main: mode === "dark" ? "#6fa8e0" : "#1e3a5f" },
          secondary: { main: "#f2a541" },
        },
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
