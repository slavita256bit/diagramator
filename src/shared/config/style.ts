import type { StyleProfile } from "@/shared/types";
// Presets are shared with the Rust exporter (single source of truth).
import gost from "../../../crates/diagram-core/presets/gost.json";
import visualStudio from "../../../crates/diagram-core/presets/visual-studio.json";
import plantuml from "../../../crates/diagram-core/presets/plantuml.json";

export const STYLE_VERSION = 2;

// JSON imports widen literal-union fields (e.g. "corner") to `string`; these are
// trusted presets (round-tripped through Rust's `StyleProfile` and tested there).
export const STYLE_PRESETS: Record<string, StyleProfile> = {
  gost: gost as StyleProfile,
  "visual-studio": visualStudio as StyleProfile,
  plantuml: plantuml as StyleProfile,
};

export const DEFAULT_STYLE: StyleProfile = STYLE_PRESETS.gost;

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
