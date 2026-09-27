import { useEffect, useState } from "react";
import { Chip, Stack, Tooltip } from "@mui/material";
import { backend } from "@/shared/api";
import type { ToolStatus } from "@/shared/types";

/** Shows whether Doxygen/Typst are runnable and where they were found. */
export function ToolStatusChips() {
  const [tools, setTools] = useState<ToolStatus[]>([]);

  useEffect(() => {
    if (!backend.available) return;
    backend.toolStatus().then(setTools).catch(() => setTools([]));
  }, []);

  if (!backend.available) {
    return <Chip size="small" label="Browser mode — sample data" color="warning" />;
  }
  return (
    <Stack direction="row" spacing={1}>
      {tools.map((t) => (
        <Tooltip key={t.name} title={t.version ? `${t.path} (${t.source})` : `Not found: ${t.path}`}>
          <Chip
            size="small"
            variant="outlined"
            color={t.version ? "success" : "error"}
            label={`${t.name} ${t.version ?? "missing"}`}
            sx={{ color: "inherit" }}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}
