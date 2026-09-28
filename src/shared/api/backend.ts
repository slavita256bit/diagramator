import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Diagram, StyleProfile, ToolStatus } from "@/shared/types";
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

  /** Reads a style profile file; Rust fills defaults and migrates old versions. */
  readStyle(path: string): Promise<StyleProfile> {
    return invoke<StyleProfile>("read_style", { path });
  },

  writeStyle(path: string, style: StyleProfile): Promise<void> {
    return invoke("write_style", { path, style });
  },

  exportTypst(path: string, diagram: Diagram, style: StyleProfile): Promise<void> {
    return invoke("export_typst", { path, diagram, style });
  },

  async pickFile(title: string, extensions: string[]): Promise<string | null> {
    const picked = await open({ multiple: false, title, filters: [{ name: extensions.join(", "), extensions }] });
    return typeof picked === "string" ? picked : null;
  },

  pickSavePath(title: string, defaultPath: string, extensions: string[]): Promise<string | null> {
    return save({ title, defaultPath, filters: [{ name: extensions.join(", "), extensions }] });
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
