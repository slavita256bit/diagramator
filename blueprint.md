# Project Blueprint: Class Diagram Generator (C++/Java)

## 1. Project Overview
Build a cross-platform desktop application (Tauri + React + Rust) that parses source code (via Doxygen), displays it as an interactive diagram, and exports it to Typst (GOST-compliant) and Visio.

## 2. Tech Stack & Architecture
- **Packaging Framework:** Tauri (v2)
- **Backend:** Rust (Handles file I/O, Doxygen XML parsing, Tool management)
- **Frontend Framework:** React + TypeScript + Vite
- **UI & State:** Material UI (MUI), Redux Toolkit (RTK) for app state/settings.
- **Interactive Diagram:** React Flow
- **Frontend Architecture:** Feature-Sliced Design (FSD) approach.

## 3. Bundled Tools & Updatability (Tauri Sidecars)
- The app must invoke `doxygen` and `typst` via Tauri Sidecars (`std::process::Command` in Rust).
- **Update Logic:** The Rust backend should include a module to ping GitHub releases, download updated binaries for `doxygen` and `typst`, and replace the local sidecar binaries.

## 4. Intermediate Representation (JSON IR)
The core contract between Backend and Frontend is the Diagram IR:
```json
{
  "classes": [
    {
      "id": "c1",
      "name": "MyClass",
      "attributes": ["- x: int"],
      "methods": ["+ calculate(): void"],
      "position": { "x": 100, "y": 200, "width": 150, "height": 80 }
    }
  ],
  "relations": [
    { "source": "c1", "target": "c2", "type": "inheritance" }
  ]
}
```

## 5. MVP Implementation Plan (Instructions for Claude Code)

### Phase 1: Initialization & Boilerplate
1. Initialize a Tauri app with React and TypeScript (`npm create tauri-app@latest`).
2. Set up the FSD folder structure in `src/`: 
   - `app/` (Providers, Redux store, Tauri IPC setup, Router)
   - `pages/` (EditorPage)
   - `widgets/` (DiagramCanvas, TopToolbar, SettingsSidebar)
   - `features/` (ExportToTypst, ExportToVisio, ParseCode)
   - `entities/` (DiagramNode, DiagramEdge - React Flow custom nodes)
   - `shared/` (MUI theme, Types, UI components, Tauri API wrappers)
3. Install dependencies: `@mui/material @emotion/react @emotion/styled @reduxjs/toolkit react-redux reactflow @xyflow/react`.

### Phase 2: Frontend MVP (Interactive View)
1. **Redux Store:** Create an RTK slice for `settings` (JSON config for GOST styles, spacing) and `appState` (loading tools, active diagram IR).
2. **React Flow Integration:** In `widgets/DiagramCanvas`, map the JSON IR to React Flow `nodes` and `edges`. Create a custom `ClassNode` (in `entities/`) using MUI cards to display methods and attributes.
3. **Position Sync:** When a user finishes dragging a node in React Flow (`onNodeDragStop`), dispatch an RTK action or update the local IR state with the new X/Y coordinates.

### Phase 3: Backend Mocking & Typst Exporter (Rust/Tauri)
1. Write a Rust Tauri command `parse_source_mock()` that returns a hardcoded mock JSON IR (simulating parsed Doxygen output with 3 classes).
2. Write a Rust Tauri command `generate_typst(ir_json)`. This function must iterate over the IR and generate Typst code.
   - **Crucial Requirement:** Use Typst's absolute positioning based on the IR coordinates (e.g., `#place(dx: 100pt, dy: 200pt)[#table(...)]`). Apply basic GOST styling variables at the top of the `.typ` file.
3. Expose these commands to the React frontend.

### Phase 4: Toolbar & Actions
1. Implement the `TopToolbar` widget.
2. Add buttons: "Mock Parse C++", "Save Coordinates", "Export Typst".
3. Wire the buttons to the Tauri IPC commands.

Please execute Phase 1 and 2 now. Write clean, modular, well-commented code following SOLID principles.