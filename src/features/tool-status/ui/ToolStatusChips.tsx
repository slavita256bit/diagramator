import { useEffect, useState } from "react";
import { Chip, CircularProgress, Stack, Tooltip } from "@mui/material";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import { backend } from "@/shared/api";
import type { ToolStatus, ToolUpdate } from "@/shared/types";

/** Shows whether Doxygen/Typst are runnable, where they were found, and lets you update them. */
export function ToolStatusChips() {
  const [tools, setTools] = useState<ToolStatus[]>([]);
  const [updates, setUpdates] = useState<ToolUpdate[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);

  function refresh() {
    backend.toolStatus().then(setTools).catch(() => setTools([]));
    backend.checkToolUpdates().then(setUpdates).catch(() => setUpdates([]));
  }

  useEffect(() => {
    if (!backend.available) return;
    refresh();
  }, []);

  if (!backend.available) {
    return <Chip size="small" label="Browser mode — sample data" color="warning" />;
  }

  async function update(name: string) {
    setUpdating(name);
    try {
      await backend.updateTool(name);
    } finally {
      setUpdating(null);
      refresh();
    }
  }

  return (
    <Stack direction="row" spacing={1}>
      {tools.map((t) => {
        const upd = updates.find((u) => u.name === t.name && u.available);
        return (
          <Tooltip
            key={t.name}
            title={
              updating === t.name
                ? `Updating to ${upd?.latest}…`
                : upd
                  ? `Update to ${upd.latest} available — click to install`
                  : t.version
                    ? `${t.path} (${t.source})`
                    : `Not found: ${t.path}`
            }
          >
            <Chip
              size="small"
              variant="outlined"
              color={t.version ? "success" : "error"}
              label={`${t.name} ${t.version ?? "missing"}`}
              sx={{ color: "inherit" }}
              icon={
                updating === t.name ? (
                  <CircularProgress size={14} sx={{ color: "inherit" }} />
                ) : upd ? (
                  <SystemUpdateIcon fontSize="small" />
                ) : undefined
              }
              onClick={upd && updating === null ? () => update(t.name) : undefined}
            />
          </Tooltip>
        );
      })}
    </Stack>
  );
}
