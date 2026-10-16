//! Per-project file `diagramator.json`, stored in the analyzed source folder.
//! Holds the full style (so the folder is portable) and the user's block positions.
//! Same back-compat rules as [`crate::style`]: every field defaults, unknown fields are ignored.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::ir::{Diagram, Note, Point, RelationAnchors, RelationType};
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
    pub hidden: BTreeMap<String, bool>,
    /// Manual connection points, matched by relation identity after re-analysis.
    pub connections: Vec<SavedConnection>,
    /// Freestanding comment boxes; not id-matched against Doxygen output, copied through as-is.
    pub notes: Vec<Note>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedConnection {
    pub source: String,
    pub target: String,
    #[serde(rename = "type")]
    pub kind: RelationType,
    pub anchors: RelationAnchors,
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
            hidden: BTreeMap::new(),
            connections: Vec::new(),
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
            c.hidden = self.hidden.get(&c.id).copied().unwrap_or(false);
            if let Some(p) = self.positions.get(&c.id) {
                c.position.x = p.x;
                c.position.y = p.y;
            }
            if let Some(cl) = self.collapsed.get(&c.id) {
                c.attributes_collapsed = cl.attributes;
                c.methods_collapsed = cl.methods;
            }
        }
        for relation in &mut diagram.relations {
            relation.anchors = self.connections.iter()
                .find(|c| c.source == relation.source && c.target == relation.target && c.kind == relation.kind)
                .map(|c| c.anchors.clone());
        }
        diagram.notes = self.notes.clone();
    }

    /// Records `diagram`'s positions/collapse state/notes, writes `diagramator.json` and, if
    /// enabled, the Typst file. Positions/collapse of classes missing from `diagram` are kept,
    /// so they survive a temporarily broken source tree.
    pub fn save(&mut self, dir: &Path, diagram: &Diagram, style: &StyleProfile) -> Result<()> {
        for c in &diagram.classes {
            self.hidden.insert(c.id.clone(), c.hidden);
            self.positions.insert(c.id.clone(), Point { x: c.position.x, y: c.position.y });
            self.collapsed.insert(
                c.id.clone(),
                ClassCollapse { attributes: c.attributes_collapsed, methods: c.methods_collapsed },
            );
        }
        for relation in &diagram.relations {
            self.connections.retain(|c| !(c.source == relation.source && c.target == relation.target && c.kind == relation.kind));
            if let Some(anchors) = &relation.anchors {
                self.connections.push(SavedConnection {
                    source: relation.source.clone(), target: relation.target.clone(), kind: relation.kind,
                    anchors: anchors.clone(),
                });
            }
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
                hidden: false,
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
        let mut original = diagram();
        original.classes[0].hidden = true;
        p.save(dir.path(), &original, &StyleProfile::default()).unwrap();
        assert!(dir.path().join("diagram.typ").is_file());

        let loaded = ProjectFile::load(dir.path()).unwrap().unwrap();
        assert_eq!(loaded, p);
        assert_eq!(loaded.positions["gone"], Point { x: 1.0, y: 2.0 });

        let mut d = diagram();
        d.classes[0].position.x = 999.0;
        loaded.apply_positions(&mut d);
        assert_eq!(d.classes[0].position.x, 10.0);
        assert!(d.classes[0].hidden);
    }

    #[test]
    fn manual_connections_survive_reanalysis_and_can_be_reset() {
        use crate::ir::{AnchorSide, EdgeAnchor, Relation};
        let dir = tempfile::tempdir().unwrap();
        let mut d = diagram();
        let anchors = RelationAnchors {
            source: Some(EdgeAnchor { side: AnchorSide::Left, offset: 0.25 }),
            target: Some(EdgeAnchor { side: AnchorSide::Bottom, offset: 0.75 }),
        };
        d.relations.push(Relation { source: "a".into(), target: "a".into(),
            kind: RelationType::Dependency, route: vec![], anchors: Some(anchors.clone()) });
        let mut p = ProjectFile { auto_export: false, ..Default::default() };
        p.save(dir.path(), &d, &StyleProfile::default()).unwrap();
        let mut loaded = ProjectFile::load(dir.path()).unwrap().unwrap();
        d.relations[0].anchors = None;
        loaded.apply_positions(&mut d);
        assert_eq!(d.relations[0].anchors.as_ref(), Some(&anchors));
        // A temporarily absent relation keeps its manual placement.
        loaded.save(dir.path(), &diagram(), &StyleProfile::default()).unwrap();
        assert_eq!(loaded.connections.len(), 1);
        d.relations[0].anchors = None;
        loaded.save(dir.path(), &d, &StyleProfile::default()).unwrap();
        assert!(ProjectFile::load(dir.path()).unwrap().unwrap().connections.is_empty());
    }

    #[test]
    fn old_minimal_file_loads() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join(PROJECT_FILE), r#"{"positions": {"a": {"x": 5, "y": 6}}, "future": 1}"#).unwrap();
        let p = ProjectFile::load(dir.path()).unwrap().unwrap();
        assert!(p.hidden.is_empty());
        assert!(p.connections.is_empty());
        let mut d = diagram();
        p.apply_positions(&mut d);
        assert!(!d.classes[0].hidden);
        assert_eq!(p.output, "diagram.typ");
        assert!(p.auto_export);
        assert_eq!(p.positions["a"], Point { x: 5.0, y: 6.0 });
    }
}
