import { useMemo, type ReactNode } from "react";
import { Provider } from "react-redux";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { selectTheme } from "@/entities/settings";
import { useAppSelector } from "@/shared/model/hooks";
import { APP_THEMES, type AppTheme } from "@/shared/config";
import { store } from "../store";

function ThemedApp({ children }: { children: ReactNode }) {
  const themeId = useAppSelector(selectTheme);
  const colors: AppTheme = APP_THEMES[themeId];
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: colors.mode,
          primary: { main: colors.primary },
          secondary: { main: colors.secondary },
          background: { default: colors.background, paper: colors.paper },
          ...(colors.text ? { text: { primary: colors.text } } : {}),
        },
        components: {
          MuiAppBar: { styleOverrides: { root: {
            backgroundColor: colors.appBar, color: "#fff", backgroundImage: "none",
          } } },
        },
      }),
    [colors],
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
