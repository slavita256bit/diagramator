//! Rendering style profile, shared by the editor and the Typst exporter.
//! Serialized as camelCase JSON; mirrored in `src/shared/types/style.ts`.
//!
//! Back-compat rules:
//! - every field has a default (`#[serde(default)]`), so older or partial files load;
//! - unknown fields are ignored, so newer files load in older builds (minus new features);
//! - a breaking change bumps [`STYLE_VERSION`] and adds a step to [`StyleProfile::migrate`].
//!
//! All lengths are editor pixels; the Typst exporter converts with [`PX_TO_PT`].

use serde::{Deserialize, Serialize};

pub const STYLE_VERSION: u32 = 1;
/// 1 CSS px = 0.75 pt, so the exported diagram matches the editor 1:1 at 100 % zoom.
pub const PX_TO_PT: f64 = 0.75;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StyleProfile {
    pub style_version: u32,
    pub name: String,
    /// Font families in priority order (first installed one wins).
    pub font: Vec<String>,
    pub font_size: f64,
    pub name_font_size: f64,
    pub stereotype_font_size: f64,
    pub line_height: f64,
    pub padding_x: f64,
    pub padding_y: f64,
    pub border_width: f64,
    pub corner_radius: f64,
    pub name_bold: bool,
    /// PlantUML-style circled letter (C/I/E/S/U) before the class name.
    pub kind_badge: bool,
    pub colors: Colors,
    /// Route edges with horizontal/vertical segments only.
    pub orthogonal_edges: bool,
    pub edge_width: f64,
    pub arrow_size: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Colors {
    pub text: String,
    pub border: String,
    pub fill: String,
    pub header_fill: String,
    pub edge: String,
    pub badge: String,
}

impl Default for Colors {
    fn default() -> Self {
        Self {
            text: "#000000".into(),
            border: "#000000".into(),
            fill: "#ffffff".into(),
            header_fill: "#ffffff".into(),
            edge: "#000000".into(),
            badge: "#add1b2".into(),
        }
    }
}

impl Default for StyleProfile {
    /// Provisional GOST look (monochrome, thin lines) — refine once the standard's PDF is in.
    fn default() -> Self {
        Self {
            style_version: STYLE_VERSION,
            name: "GOST".into(),
            font: fonts::TIMES.iter().map(|s| s.to_string()).collect(),
            font_size: 13.0,
            name_font_size: 14.0,
            stereotype_font_size: 11.0,
            line_height: 18.0,
            padding_x: 8.0,
            padding_y: 4.0,
            border_width: 1.0,
            corner_radius: 0.0,
            name_bold: true,
            kind_badge: false,
            colors: Colors::default(),
            orthogonal_edges: false,
            edge_width: 1.0,
            arrow_size: 12.0,
        }
    }
}

pub mod fonts {
    pub const TIMES: &[&str] = &["Times New Roman", "Liberation Serif", "serif"];
    pub const GOST_A: &[&str] = &["GOST type A", "GOST Type AU", "Times New Roman", "serif"];
    pub const ARIAL: &[&str] = &["Arial", "Liberation Sans", "sans-serif"];
}

/// Built-in presets (`presets/*.json`), shared with the frontend.
pub const PRESETS: &[(&str, &str)] = &[
    ("gost", include_str!("../presets/gost.json")),
    ("visual-studio", include_str!("../presets/visual-studio.json")),
    ("plantuml", include_str!("../presets/plantuml.json")),
];

impl StyleProfile {
    /// Parse a profile of any known version and upgrade it to the current one.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        let mut p: Self = serde_json::from_str(json)?;
        p.migrate();
        Ok(p)
    }

    /// Upgrade older profiles in place. Add `if self.style_version < N { … }` steps here.
    pub fn migrate(&mut self) {
        if self.style_version == 0 {
            // Unversioned file: fields were introduced with v1, defaults already filled in.
            self.style_version = 1;
        }
        self.style_version = self.style_version.max(STYLE_VERSION);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_and_unknown_fields_load() {
        let p = StyleProfile::from_json(r##"{"fontSize": 20, "futureField": true, "colors": {"edge": "#ff0000"}}"##)
            .unwrap();
        assert_eq!(p.font_size, 20.0);
        assert_eq!(p.colors.edge, "#ff0000");
        assert_eq!(p.colors.text, "#000000");
        assert_eq!(p.style_version, STYLE_VERSION);
    }

    #[test]
    fn gost_preset_is_default() {
        assert_eq!(StyleProfile::from_json(PRESETS[0].1).unwrap(), StyleProfile::default());
    }

    #[test]
    fn roundtrip() {
        for (_, preset) in PRESETS {
            let p = StyleProfile::from_json(preset).unwrap();
            let json = serde_json::to_string(&p).unwrap();
            assert_eq!(StyleProfile::from_json(&json).unwrap(), p);
        }
    }
}
