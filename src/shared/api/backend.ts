import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { Diagram, OpenedProject, StyleProfile, ToolStatus } from "@/shared/types";
import { sampleDiagram } from "./sample";

/** Typed wrappers around the Rust commands in `src-tauri/src/commands.rs`. */
export const backend = {
  /** True inside the Tauri shell; false when the UI runs in a plain browser (`pnpm dev`). */
  available: isTauri(),

  /** Runs Doxygen and restores positions/style from the folder's `diagramator.json`. */
  analyzeProject(path: string): Promise<OpenedProject> {
    return invoke<OpenedProject>("analyze_project", { path });
  },

  /** Writes `diagramator.json` (+ Typst file if auto-export is on); returns the Typst path. */
  saveProject(path: string, diagram: Diagram, style: StyleProfile): Promise<string | null> {
    return invoke<string | null>("save_project", { path, diagram, style });
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

  listExamples(): Promise<{ name: string; path: string }[]> {
    return invoke("list_examples");
  },

  /** Copies a bundled example into app data (once); returns its writable folder. */
  prepareExample(name: string): Promise<string> {
    return invoke<string>("prepare_example", { name });
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
