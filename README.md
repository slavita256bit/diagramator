# Diagramator

Desktop class-diagram generator for C++/Java: runs Doxygen over a source tree,
converts its XML into a diagram IR, and renders it as an interactive UML class
diagram (React Flow) that exports to Typst. Diagramator updates itself, and can
fetch newer Doxygen/Typst builds on its own — see `PLAN.md` for full status.

Tauri v2 · Rust · React + TypeScript + Vite · MUI · Redux Toolkit · React Flow

## Install

**macOS / Linux**

```sh
curl -fsSL https://raw.githubusercontent.com/slavita256bit/diagramator/master/install.sh | bash
```

Picks a `.deb`/`.rpm` via your package manager on Linux (falling back to an
AppImage in `~/.local/bin`), or a `.dmg` on macOS.

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/slavita256bit/diagramator/master/install.ps1 | iex
```

Or grab an installer directly from [the latest release](https://github.com/slavita256bit/diagramator/releases/latest).
Installed builds bundle Doxygen and Typst — nothing else to set up, and the app
checks for its own updates on launch.

## Development

### Prerequisites

- Node.js 20+ and pnpm
- Rust **1.90+** (`rustup update stable`) — required by Tauri 2.12
- Tauri Linux deps (Fedora):
  `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel`
  (other platforms: https://v2.tauri.app/start/prerequisites/)
- `doxygen` on `PATH` for local dev (`pnpm tauri dev`/`pnpm tauri build` always use
  `PATH`; only release builds bundle sidecars — see `src-tauri/binaries/README.md`)

### Commands

```sh
pnpm install
pnpm tauri dev          # desktop app with hot reload
pnpm tauri build        # release bundle
pnpm dev                # UI only, in the browser, with sample data (no Rust needed)
pnpm build              # typecheck + build frontend

cargo test -p diagram-core                                 # parser/IR tests (runs real doxygen)
cargo run -p diagram-core --example analyze -- <src-dir>    # print IR JSON for a folder
```

### Releases

Pushing a `v*` tag runs `.github/workflows/release.yml`: it builds installers for
Linux/Windows/macOS (arm64 + x86_64) and leaves a draft GitHub Release. Doxygen
and Typst are fetched per-platform by `scripts/fetch-sidecars.mjs` and bundled as
sidecars. A release must be published as a **full release, not a pre-release**,
for `install.sh`/`install.ps1` and the in-app updater to find it — GitHub's
"latest release" API skips pre-releases.

## Third-party tools

Release builds bundle `doxygen` and `typst` as external binaries (unmodified
upstream builds; see `scripts/fetch-sidecars.mjs`). Their licenses (GPL-2.0 and
Apache-2.0) ship inside the installer under `licenses/` — also in
`THIRD_PARTY_LICENSES/` in this repo.

## Layout

```
crates/diagram-core/   Tauri-free core: IR, Doxygen runner + XML parser, auto-layout
src-tauri/             Tauri shell: commands (analyze_project, load_doxygen_xml, tool_status), tool lookup
src/                   Frontend, Feature-Sliced Design:
  app/                   providers, store
  pages/diagram/         main screen
  widgets/               toolbar, diagram-canvas
  features/              analyze-project, tool-status, app-update, edit-style, export-typst, save-project
  entities/              diagram (slice, UML node/edge/markers, IR→React Flow), settings
  shared/                IR types, backend API, typed hooks
install.sh / install.ps1  end-user install scripts (see Install, above)
scripts/fetch-sidecars.mjs  CI-only: downloads doxygen/typst for release builds
```

The IR (`crates/diagram-core/src/ir.rs` ↔ `src/shared/types/diagram.ts`) follows
`docs/architecture.md`, plus a `kind` field on classes (class/struct/interface/enum/union)
used for UML stereotypes. Relation `source` is always the dependent side
(child, whole, or user).
