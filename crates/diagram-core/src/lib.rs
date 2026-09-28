//! Core of Diagramator: the diagram intermediate representation (IR),
//! Doxygen invocation / XML parsing, and initial auto-layout.
//!
//! This crate has no Tauri dependency so it can be built and tested headless.

pub mod doxygen;
pub mod ir;
pub mod layout;
pub mod style;
pub mod typst;

pub use ir::{ClassKind, ClassNode, Diagram, Position, Relation, RelationType};
pub use style::StyleProfile;

use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse Doxygen XML ({file}): {source}")]
    Xml {
        file: String,
        #[source]
        source: roxmltree::Error,
    },
    #[error("Doxygen executable not found or not runnable: {0}")]
    DoxygenNotFound(String),
    #[error("Doxygen failed (exit code {code:?}): {stderr}")]
    DoxygenFailed { code: Option<i32>, stderr: String },
    #[error("invalid input: {0}")]
    InvalidInput(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// Full pipeline: run Doxygen over `source_dir`, parse the XML and lay out the result.
pub fn analyze_sources(doxygen_bin: &Path, source_dir: &Path) -> Result<Diagram> {
    let out = doxygen::run_doxygen(doxygen_bin, source_dir)?;
    analyze_xml_dir(&out.xml_dir())
}

/// Parse an already-generated Doxygen XML directory and lay out the result.
pub fn analyze_xml_dir(xml_dir: &Path) -> Result<Diagram> {
    let mut diagram = doxygen::parse_xml_dir(xml_dir)?;
    layout::auto_layout(&mut diagram);
    Ok(diagram)
}
