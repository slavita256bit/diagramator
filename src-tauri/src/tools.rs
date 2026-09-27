//! Locates the external tools (Doxygen, Typst).
//!
//! Lookup order:
//! 1. `<app data>/tools/<name>` — where the (future) updater installs newer releases;
//! 2. the bundled sidecar next to the app executable (Tauri `externalBin`);
//! 3. `<name>` on `PATH`.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Copy)]
pub enum Tool {
    Doxygen,
    Typst,
}

impl Tool {
    fn name(self) -> &'static str {
        match self {
            Tool::Doxygen => "doxygen",
            Tool::Typst => "typst",
        }
    }

    fn file_name(self) -> String {
        format!("{}{}", self.name(), std::env::consts::EXE_SUFFIX)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolStatus {
    pub name: &'static str,
    pub path: String,
    /// `None` when the tool could not be executed.
    pub version: Option<String>,
    pub source: ToolSource,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolSource {
    Updated,
    Bundled,
    System,
}

fn locate(app: &AppHandle, tool: Tool) -> (PathBuf, ToolSource) {
    if let Ok(dir) = app.path().app_data_dir() {
        let p = dir.join("tools").join(tool.file_name());
        if p.is_file() {
            return (p, ToolSource::Updated);
        }
    }
    if let Some(dir) = std::env::current_exe()
        .ok()
        .and_then(|e| e.parent().map(Path::to_path_buf))
    {
        let p = dir.join(tool.file_name());
        if p.is_file() {
            return (p, ToolSource::Bundled);
        }
    }
    (PathBuf::from(tool.file_name()), ToolSource::System)
}

pub fn resolve(app: &AppHandle, tool: Tool) -> PathBuf {
    locate(app, tool).0
}

pub fn status(app: &AppHandle, tool: Tool) -> ToolStatus {
    let (path, source) = locate(app, tool);
    let version = Command::new(&path)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());
    ToolStatus {
        name: tool.name(),
        path: path.display().to_string(),
        version,
        source,
    }
}
