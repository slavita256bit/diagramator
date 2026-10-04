//! Per-project file `diagramator.json`, stored in the analyzed source folder.
//! Holds the full style (so the folder is portable) and the user's block positions.
//! Same back-compat rules as [`crate::style`]: every field defaults, unknown fields are ignored.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::ir::{Diagram, Note, Point};
use crate::style::StyleProfile;
use crate::Result;

pub const PROJECT_FILE: &str = "diagramator.json";
pub const PROJECT_VERSION: u32 = 2;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProjectFile {
    pub version: u32,
    /// Typst output, relative to the project folder.
    pub output: String,
    /// Regenerate `output` on every save.
    pub auto_export: bool,
    /// `None` until the first save: the app's current style is used.
    pub style: Option<StyleProfile>,
    /// Top-left corner per class id, in editor px.
    pub positions: BTreeMap<String, Point>,
    /// Which sections are collapsed, per class id.
    pub collapsed: BTreeMap<String, ClassCollapse>,
    /// Freestanding comment boxes; not id-matched against Doxygen output, copied through as-is.
    pub notes: Vec<Note>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ClassCollapse {
    pub attributes: bool,
    pub methods: bool,
}

impl Default for ProjectFile {
    fn default() -> Self {
        Self {
            version: PROJECT_VERSION,
            output: "diagram.typ".into(),
            auto_export: true,
            style: None,
            positions: BTreeMap::new(),
            collapsed: BTreeMap::new(),
            notes: Vec::new(),
        }
    }
}

impl ProjectFile {
    /// Loads `<dir>/diagramator.json`; `Ok(None)` if the folder has none yet.
    pub fn load(dir: &Path) -> Result<Option<Self>> {
        let path = dir.join(PROJECT_FILE);
        if !path.is_file() {
            return Ok(None);
        }
        let json = std::fs::read_to_string(&path)?;
        let mut p: Self = serde_json::from_str(&json)
            .map_err(|e| crate::Error::InvalidInput(format!("{}: {e}", path.display())))?;
        if let Some(style) = &mut p.style {
            style.migrate();
        }
        p.version = p.version.max(PROJECT_VERSION);
        Ok(Some(p))
    }

    /// Moves classes to their saved positions and restores section-collapse state.
    /// Classes without a saved entry keep the auto-layout / start expanded. Also restores
    /// freestanding notes, which aren't id-matched against Doxygen output.
    pub fn apply_positions(&self, diagram: &mut Diagram) {
        for c in &mut diagram.classes {
            if let Some(p) = self.positions.get(&c.id) {
                c.position.x = p.x;
                c.position.y = p.y;
            }
            if let Some(cl) = self.collapsed.get(&c.id) {
                c.attributes_collapsed = cl.attributes;
                c.methods_collapsed = cl.methods;
            }
        }
        diagram.notes = self.notes.clone();
    }

    /// Records `diagram`'s positions/collapse state/notes, writes `diagramator.json` and, if
    /// enabled, the Typst file. Positions/collapse of classes missing from `diagram` are kept,
    /// so they survive a temporarily broken source tree.
    pub fn save(&mut self, dir: &Path, diagram: &Diagram, style: &StyleProfile) -> Result<()> {
        for c in &diagram.classes {
            self.positions.insert(c.id.clone(), Point { x: c.position.x, y: c.position.y });
            self.collapsed.insert(
                c.id.clone(),
                ClassCollapse { attributes: c.attributes_collapsed, methods: c.methods_collapsed },
            );
        }
        self.notes = diagram.notes.clone();
        self.style = Some(style.clone());
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| crate::Error::InvalidInput(e.to_string()))?;
        std::fs::write(dir.join(PROJECT_FILE), json + "\n")?;
        if self.auto_export {
            let output_path = dir.join(&self.output);
            if let Some(output_dir) = output_path.parent() {
                crate::typst::write_note_attachments(output_dir, diagram)?;
            }
            std::fs::write(output_path, crate::typst::render(diagram, style))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ir::{ClassKind, ClassNode, Position};

    fn diagram() -> Diagram {
        Diagram {
            classes: vec![ClassNode {
                id: "a".into(),
                name: "A".into(),
                kind: ClassKind::Class,
                attributes: vec![],
                methods: vec![],
                template_params: vec![],
                attributes_collapsed: false,
                methods_collapsed: false,
                position: Position { x: 10.0, y: 20.0, width: 100.0, height: 60.0 },
            }],
            relations: vec![],
            notes: vec![],
        }
    }

    #[test]
    fn save_load_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(ProjectFile::load(dir.path()).unwrap(), None);

        let mut p = ProjectFile::default();
        p.positions.insert("gone".into(), Point { x: 1.0, y: 2.0 });
        p.save(dir.path(), &diagram(), &StyleProfile::default()).unwrap();
        assert!(dir.path().join("diagram.typ").is_file());

        let loaded = ProjectFile::load(dir.path()).unwrap().unwrap();
        assert_eq!(loaded, p);
        assert_eq!(loaded.positions["gone"], Point { x: 1.0, y: 2.0 });

        let mut d = diagram();
        d.classes[0].position.x = 999.0;
        loaded.apply_positions(&mut d);
        assert_eq!(d.classes[0].position.x, 10.0);
    }

    #[test]
    fn old_minimal_file_loads() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(PROJECT_FILE), r#"{"positions": {"a": {"x": 5, "y": 6}}, "future": 1}"#).unwrap();
        let p = ProjectFile::load(dir.path()).unwrap().unwrap();
        assert_eq!(p.output, "diagram.typ");
        assert!(p.auto_export);
        assert_eq!(p.positions["a"], Point { x: 5.0, y: 6.0 });
    }
}
