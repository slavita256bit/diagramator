use std::path::PathBuf;

use diagram_core::{Diagram, ProjectFile, StyleProfile};
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::tools::{self, Tool, ToolStatus};

#[derive(Serialize)]
pub struct OpenedProject {
    diagram: Diagram,
    /// `diagramator.json` of the folder, if it has one; saved positions are already applied.
    project: Option<ProjectFile>,
}

/// Runs Doxygen over a source directory and returns the laid-out diagram,
/// with positions restored from the folder's `diagramator.json`.
#[tauri::command]
pub async fn analyze_project(app: AppHandle, path: String) -> Result<OpenedProject, String> {
    let doxygen = tools::resolve(&app, Tool::Doxygen);
    tauri::async_runtime::spawn_blocking(move || {
        let dir = PathBuf::from(path);
        let mut diagram = diagram_core::analyze_sources(&doxygen, &dir)?;
        let project = ProjectFile::load(&dir)?;
        if let Some(p) = &project {
            p.apply_positions(&mut diagram);
        }
        Ok::<_, diagram_core::Error>(OpenedProject { diagram, project })
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Writes `diagramator.json` (positions + style) and, if enabled there, the Typst file.
/// Returns the path of the written Typst file, if any.
#[tauri::command]
pub async fn save_project(path: String, diagram: Diagram, style: StyleProfile) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = PathBuf::from(path);
        let mut project = ProjectFile::load(&dir)?.unwrap_or_default();
        project.save(&dir, &diagram, &style)?;
        Ok::<_, diagram_core::Error>(project.auto_export.then(|| dir.join(&project.output).display().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
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

#[tauri::command]
pub async fn check_tool_updates(app: AppHandle) -> Vec<tools::ToolUpdate> {
    tools::check_updates(&app).await
}

#[tauri::command]
pub async fn update_tool(app: AppHandle, name: String) -> Result<ToolStatus, String> {
    tools::update_tool(&app, &name).await
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
    if let Some(dir) = PathBuf::from(&path).parent() {
        diagram_core::typst::write_note_attachments(dir, &diagram).map_err(|e| format!("{path}: {e}"))?;
    }
    std::fs::write(&path, diagram_core::typst::render(&diagram, &style)).map_err(|e| format!("{path}: {e}"))
}

/// Re-runs the layered auto-layout (same algorithm a fresh Doxygen analysis uses) on an
/// already-open diagram. The frontend re-measures box sizes afterward for the current style.
#[tauri::command]
pub fn auto_arrange(mut diagram: Diagram) -> Diagram {
    diagram_core::layout::auto_layout(&mut diagram);
    diagram
}

#[derive(Serialize)]
pub struct Example {
    name: String,
    path: String,
}

/// Bundled example projects. They are copied to `<app data>/examples/` on first open, since the
/// install folder is read-only and opening a project writes `diagramator.json` into it.
#[tauri::command]
pub fn list_examples(app: AppHandle) -> Result<Vec<Example>, String> {
    let src = examples_dir(&app)?;
    let dst = app.path().app_data_dir().map_err(|e| e.to_string())?.join("examples");
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&src).map_err(|e| format!("{}: {e}", src.display()))? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().is_dir() {
            let name = entry.file_name().to_string_lossy().into_owned();
            out.push(Example { path: dst.join(&name).display().to_string(), name });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

/// Copies example `name` into app data (once) and returns the writable path.
#[tauri::command]
pub fn prepare_example(app: AppHandle, name: String) -> Result<String, String> {
    if name.contains(['/', '\\']) || name.starts_with('.') {
        return Err(format!("invalid example name: {name}"));
    }
    let src = examples_dir(&app)?.join(&name);
    let dst = app.path().app_data_dir().map_err(|e| e.to_string())?.join("examples").join(&name);
    if !dst.exists() {
        copy_dir(&src, &dst).map_err(|e| format!("{}: {e}", src.display()))?;
    }
    Ok(dst.display().to_string())
}

fn examples_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Dev builds read the repo folder directly so example edits show up without rebuilding.
    #[cfg(debug_assertions)]
    {
        let _ = app;
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../examples"))
    }
    #[cfg(not(debug_assertions))]
    app.path()
        .resource_dir()
        .map(|d| d.join("examples"))
        .map_err(|e| e.to_string())
}

fn copy_dir(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&entry.path(), &to)?;
        } else {
            std::fs::copy(entry.path(), to)?;
        }
    }
    Ok(())
}
