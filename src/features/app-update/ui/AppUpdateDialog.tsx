import { useEffect, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { backend } from "@/shared/api";

/** Checks for a newer Diagramator release on mount and offers to install it. */
export function AppUpdateDialog() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!backend.available) return;
    check()
      .then((u) => u && setUpdate(u))
      .catch(() => {});
  }, []);

  if (!update) return null;

  async function install() {
    setInstalling(true);
    setError(null);
    try {
      await update!.downloadAndInstall();
      await relaunch();
    } catch (e) {
      setError(String(e));
      setInstalling(false);
    }
  }

  return (
    <Dialog open onClose={() => setUpdate(null)}>
      <DialogTitle>Diagramator {update.version} is available</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
          {update.body ?? "No release notes."}
        </Typography>
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setUpdate(null)} disabled={installing}>
          Later
        </Button>
        <Button onClick={install} variant="contained" disabled={installing}>
          {installing ? "Installing…" : "Restart & Install"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
