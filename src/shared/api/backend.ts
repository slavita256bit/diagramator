import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Diagram, ToolStatus } from "@/shared/types";
import { sampleDiagram } from "./sample";

/** Typed wrappers around the Rust commands in `src-tauri/src/commands.rs`. */
export const backend = {
  /** True inside the Tauri shell; false when the UI runs in a plain browser (`pnpm dev`). */
  available: isTauri(),

  analyzeProject(path: string): Promise<Diagram> {
    return invoke<Diagram>("analyze_project", { path });
  },

  loadDoxygenXml(path: string): Promise<Diagram> {
    return invoke<Diagram>("load_doxygen_xml", { path });
  },

  toolStatus(): Promise<ToolStatus[]> {
    return invoke<ToolStatus[]>("tool_status");
  },

  async pickDirectory(title: string): Promise<string | null> {
    const picked = await open({ directory: true, multiple: false, title });
    return typeof picked === "string" ? picked : null;
  },

  /** Browser-only fallback so the UI can be developed without the Rust side. */
  sampleDiagram(): Diagram {
    return structuredClone(sampleDiagram);
  },
};
