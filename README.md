# Diagramator

Desktop class-diagram generator for C++/Java: runs Doxygen over a source tree,
converts its XML into a diagram IR and renders it as an interactive UML class
diagram. (Typst/Visio export and tool updates are later phases — see `blueprint.md`.)

Tauri v2 · Rust · React + TypeScript + Vite · MUI · Redux Toolkit · React Flow

## Prerequisites

- Node.js 20+ and npm
- Rust **1.90+** (`rustup update stable`) — required by Tauri 2.12
- Tauri Linux deps (Fedora):
  `sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel`
  (other platforms: https://v2.tauri.app/start/prerequisites/)
- `doxygen` on `PATH` (until sidecars are bundled — see `src-tauri/binaries/README.md`)

## Commands

```sh
npm install
npm run tauri dev          # desktop app with hot reload
npm run tauri build        # release bundle
npm run dev                # UI only, in the browser, with sample data (no Rust needed)
npm run build              # typecheck + build frontend

cargo test -p diagram-core                                   # parser/IR tests (runs real doxygen)
cargo run -p diagram-core --example analyze -- <src-dir>    # print IR JSON for a folder
```

## Layout

```
crates/diagram-core/   Tauri-free core: IR, Doxygen runner + XML parser, auto-layout
src-tauri/             Tauri shell: commands (analyze_project, load_doxygen_xml, tool_status), tool lookup
src/                   Frontend, Feature-Sliced Design:
  app/                   providers, store
  pages/diagram/         main screen
  widgets/               toolbar, diagram-canvas
  features/              analyze-project, tool-status
  entities/              diagram (slice, UML node/edge/markers, IR→React Flow), settings
  shared/                IR types, backend API, typed hooks
```

The IR (`crates/diagram-core/src/ir.rs` ↔ `src/shared/types/diagram.ts`) follows
the blueprint, plus a `kind` field on classes (class/struct/interface/enum/union)
used for UML stereotypes. Relation `source` is always the dependent side
(child, whole, or user).
