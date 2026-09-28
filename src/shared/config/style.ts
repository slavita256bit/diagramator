import type { StyleProfile } from "@/shared/types";
// Presets are shared with the Rust exporter (single source of truth).
import gost from "../../../crates/diagram-core/presets/gost.json";
import visualStudio from "../../../crates/diagram-core/presets/visual-studio.json";
import plantuml from "../../../crates/diagram-core/presets/plantuml.json";

export const STYLE_VERSION = 1;

export const STYLE_PRESETS: Record<string, StyleProfile> = {
  gost,
  "visual-studio": visualStudio,
  plantuml,
};

export const DEFAULT_STYLE: StyleProfile = gost;

/** Font choices with fallbacks; same lists as `style::fonts` in Rust. */
export const FONT_CHOICES: Record<string, string[]> = {
  "Times New Roman": ["Times New Roman", "Liberation Serif", "serif"],
  "GOST type A": ["GOST type A", "GOST Type AU", "Times New Roman", "serif"],
  Arial: ["Arial", "Liberation Sans", "sans-serif"],
};

/**
 * Fill missing fields with defaults (older/partial profiles), like `#[serde(default)]`
 * on the Rust side. Files go through Rust `read_style`, which also migrates versions.
 */
export function normalizeStyle(p: Partial<StyleProfile> | null | undefined): StyleProfile {
  return {
    ...DEFAULT_STYLE,
    ...p,
    colors: { ...DEFAULT_STYLE.colors, ...p?.colors },
    styleVersion: Math.max(p?.styleVersion ?? 0, STYLE_VERSION),
  };
}

const GENERIC = new Set(["serif", "sans-serif", "monospace"]);

/** CSS `font-family` value for a profile's font list. */
export function cssFontFamily(font: string[]): string {
  return font.map((f) => (GENERIC.has(f) ? f : `"${f}"`)).join(", ");
}
