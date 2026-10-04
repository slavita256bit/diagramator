//! Locates the external tools (Doxygen, Typst).
//!
//! Lookup order:
//! 1. `<app data>/tools/<name>` — where the (future) updater installs newer releases;
//! 2. the bundled sidecar next to the app executable (Tauri `externalBin`);
//! 3. `<name>` on `PATH`.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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

    /// Sidecar file name next to the installed executable. Prefixed (unlike `file_name`)
    /// because Linux packaging (.deb/.rpm/AppImage) installs `externalBin` entries straight
    /// into the same directory as the main binary — plain "doxygen" there collided with the
    /// system `doxygen` package (`rpm` refused to install: file conflict on `/usr/bin/doxygen`).
    fn bundled_file_name(self) -> String {
        format!("diagramator-{}{}", self.name(), std::env::consts::EXE_SUFFIX)
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
        let p = dir.join(tool.bundled_file_name());
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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolUpdate {
    pub name: &'static str,
    pub current: Option<String>,
    pub latest: String,
    pub available: bool,
}

#[derive(Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
    digest: Option<String>,
}

const USER_AGENT: &str = "diagramator";

async fn latest_release(client: &reqwest::Client, repo: &str) -> Result<Release, String> {
    client
        .get(format!("https://api.github.com/repos/{repo}/releases/latest"))
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| e.to_string())?
        .json::<Release>()
        .await
        .map_err(|e| e.to_string())
}

fn repo(tool: Tool) -> &'static str {
    match tool {
        Tool::Doxygen => "doxygen/doxygen",
        Tool::Typst => "typst/typst",
    }
}

fn version_from_tag(tool: Tool, tag: &str) -> String {
    match tool {
        Tool::Doxygen => tag.trim_start_matches("Release_").replace('_', "."),
        Tool::Typst => tag.trim_start_matches('v').to_string(),
    }
}

/// Release asset name for the current OS/arch, `None` if this tool has no build for it.
fn asset_name(tool: Tool, version: &str) -> Option<String> {
    let (os, arch) = (std::env::consts::OS, std::env::consts::ARCH);
    match (tool, os, arch) {
        (Tool::Doxygen, "linux", "x86_64") => Some(format!("doxygen-{version}.linux.bin.tar.gz")),
        (Tool::Doxygen, "windows", "x86_64") => Some(format!("doxygen-{version}.windows.x64.bin.zip")),
        (Tool::Doxygen, "macos", "aarch64") => Some(format!("doxygen-{version}-mac-arm.zip")),
        (Tool::Doxygen, "macos", "x86_64") => Some(format!("doxygen-{version}-mac-intel.zip")),
        (Tool::Typst, "linux", "x86_64") => Some("typst-x86_64-unknown-linux-musl.tar.xz".into()),
        (Tool::Typst, "windows", "x86_64") => Some("typst-x86_64-pc-windows-msvc.zip".into()),
        (Tool::Typst, "macos", "aarch64") => Some("typst-aarch64-apple-darwin.tar.xz".into()),
        (Tool::Typst, "macos", "x86_64") => Some("typst-x86_64-apple-darwin.tar.xz".into()),
        _ => None,
    }
}

/// Checks the latest GitHub release of each tool against what `status()` finds installed.
/// Tools whose release API call fails (offline, rate-limited) are left out, not reported as errors.
pub async fn check_updates(app: &AppHandle) -> Vec<ToolUpdate> {
    let client = reqwest::Client::new();
    let mut out = Vec::new();
    for tool in [Tool::Doxygen, Tool::Typst] {
        let Ok(release) = latest_release(&client, repo(tool)).await else { continue };
        let latest = version_from_tag(tool, &release.tag_name);
        let current = status(app, tool).version;
        let available = current.as_deref().is_none_or(|c| !c.contains(&latest));
        out.push(ToolUpdate { name: tool.name(), current, latest, available });
    }
    out
}

/// Downloads the latest release of `name` ("doxygen"/"typst") for this OS/arch into
/// `<app data>/tools/`, verifying it against the GitHub-reported sha256 digest when present.
pub async fn update_tool(app: &AppHandle, name: &str) -> Result<ToolStatus, String> {
    let tool = [Tool::Doxygen, Tool::Typst]
        .into_iter()
        .find(|t| t.name() == name)
        .ok_or_else(|| format!("unknown tool: {name}"))?;

    let client = reqwest::Client::new();
    let release = latest_release(&client, repo(tool)).await?;
    let version = version_from_tag(tool, &release.tag_name);
    let asset_name = asset_name(tool, &version).ok_or_else(|| format!("no {name} build for this platform"))?;
    let asset = release
        .assets
        .iter()
        .find(|a| a.name == asset_name)
        .ok_or_else(|| format!("release {} is missing asset {asset_name}", release.tag_name))?;

    let bytes = client
        .get(&asset.browser_download_url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(expected) = asset.digest.as_deref().and_then(|d| d.strip_prefix("sha256:")) {
        let actual = format!("{:x}", Sha256::digest(&bytes));
        if actual != expected {
            return Err(format!("checksum mismatch for {asset_name}"));
        }
    }

    let work_dir = std::env::temp_dir().join(format!("diagramator-update-{name}"));
    let _ = std::fs::remove_dir_all(&work_dir);
    std::fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;
    let archive_path = work_dir.join(&asset_name);
    std::fs::write(&archive_path, &bytes).map_err(|e| format!("{}: {e}", archive_path.display()))?;

    let extract_dir = work_dir.join("extracted");
    extract_archive(&archive_path, &extract_dir)?;

    let found = find_binary(&extract_dir, &tool.file_name())
        .or_else(|| find_binary(&extract_dir, tool.name()))
        .ok_or_else(|| format!("could not find {name} inside {asset_name}"))?;

    let tools_dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("tools");
    std::fs::create_dir_all(&tools_dir).map_err(|e| e.to_string())?;
    let dest = tools_dir.join(tool.file_name());
    std::fs::copy(&found, &dest).map_err(|e| format!("{}: {e}", dest.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
    }
    let _ = std::fs::remove_dir_all(&work_dir);

    Ok(status(app, tool))
}

/// `tar` auto-detects gzip/xz, and Windows' bundled `bsdtar` also handles `.zip`;
/// elsewhere `.zip` goes through `unzip`, which `tar` can't read there.
fn extract_archive(archive: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let is_zip = archive.extension().is_some_and(|e| e == "zip");
    let mut cmd = if is_zip && std::env::consts::OS != "windows" {
        let mut c = Command::new("unzip");
        c.arg("-q").arg(archive).arg("-d").arg(dest);
        c
    } else {
        let mut c = Command::new("tar");
        c.arg("-xf").arg(archive).arg("-C").arg(dest);
        c
    };
    // When running from an AppImage, the runtime points `LD_LIBRARY_PATH` at its own bundled
    // libs (e.g. a newer liblzma) so the *app* can load them — but that env is inherited by
    // this child process too, making the system `tar`/`unzip` load the wrong library version
    // and crash (`version 'XZ_5.6.0' not found`). Extraction tools must use the system libs.
    cmd.env_remove("LD_LIBRARY_PATH");
    let status = cmd.status().map_err(|e| e.to_string())?;
    status
        .success()
        .then_some(())
        .ok_or_else(|| format!("failed to extract {}", archive.display()))
}

/// Recursively finds the first regular file named exactly `name` under `dir`.
fn find_binary(dir: &Path, name: &str) -> Option<PathBuf> {
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_binary(&path, name) {
                return Some(found);
            }
        } else if path.file_name().and_then(|n| n.to_str()) == Some(name) {
            return Some(path);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_from_tag_strips_prefixes() {
        assert_eq!(version_from_tag(Tool::Doxygen, "Release_1_18_0"), "1.18.0");
        assert_eq!(version_from_tag(Tool::Typst, "v0.15.1"), "0.15.1");
    }

    #[test]
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    fn asset_name_matches_known_release_filenames() {
        // Pinned against scripts/fetch-sidecars.mjs's ASSETS table — keep both in sync.
        assert_eq!(
            asset_name(Tool::Doxygen, "1.18.0").unwrap(),
            "doxygen-1.18.0.linux.bin.tar.gz"
        );
        assert_eq!(
            asset_name(Tool::Typst, "0.15.1").unwrap(),
            "typst-x86_64-unknown-linux-musl.tar.xz"
        );
    }
}
