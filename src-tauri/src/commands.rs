use std::path::PathBuf;

use diagram_core::{Diagram, StyleProfile};
use tauri::AppHandle;

use crate::tools::{self, Tool, ToolStatus};

/// Runs Doxygen over a source directory and returns the laid-out diagram.
#[tauri::command]
pub async fn analyze_project(app: AppHandle, path: String) -> Result<Diagram, String> {
    let doxygen = tools::resolve(&app, Tool::Doxygen);
    run_blocking(move || diagram_core::analyze_sources(&doxygen, &PathBuf::from(path))).await
}

/// Builds a diagram from an existing Doxygen XML output directory.
#[tauri::command]
pub async fn load_doxygen_xml(path: String) -> Result<Diagram, String> {
    run_blocking(move || diagram_core::analyze_xml_dir(&PathBuf::from(path))).await
}

#[tauri::command]
pub async fn tool_status(app: AppHandle) -> Vec<ToolStatus> {
    tauri::async_runtime::spawn_blocking(move || {
        [Tool::Doxygen, Tool::Typst]
            .into_iter()
            .map(|t| tools::status(&app, t))
            .collect()
    })
    .await
    .unwrap_or_default()
}

async fn run_blocking<F>(f: F) -> Result<Diagram, String>
where
    F: FnOnce() -> diagram_core::Result<Diagram> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Reads a style profile, filling defaults and migrating older versions.
#[tauri::command]
pub fn read_style(path: String) -> Result<StyleProfile, String> {
    let json = std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))?;
    StyleProfile::from_json(&json).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub fn write_style(path: String, style: StyleProfile) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&style).map_err(|e| e.to_string())?;
    std::fs::write(&path, json + "\n").map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub fn export_typst(path: String, diagram: Diagram, style: StyleProfile) -> Result<(), String> {
    std::fs::write(&path, diagram_core::typst::render(&diagram, &style)).map_err(|e| format!("{path}: {e}"))
}
