# Architecture

## Stack
Tauri v2 · Rust · React + TypeScript + Vite · MUI · Redux Toolkit · React Flow.
External tools (`doxygen`, `typst`) resolved by `src-tauri/src/tools.rs`:
`<app data>/tools/` (future updater) → bundled sidecar → `PATH`.

## Data flow
source dir → `doxygen` (XML) → `doxygen::parse_xml_dir` → `layout::auto_layout`
→ `Diagram` IR → frontend (`toFlow.ts` → React Flow). Drags write back via `classMoved`.

## IR
```json
{
  "classes": [{ "id": "c1", "name": "MyClass", "kind": "class",
    "attributes": ["- x: int"], "methods": ["+ calculate(): void"],
    "position": { "x": 100, "y": 200, "width": 150, "height": 80 } }],
  "relations": [{ "source": "c1", "target": "c2", "type": "inheritance" }]
}
```
`kind`: class | struct | interface | enum | union (UML stereotypes).
`type`: inheritance | realization | composition | aggregation | association | dependency.

## Style profiles
JSON profile (font list, sizes, paddings, colors, badge, edge/arrow sizes), lengths in
editor px. Presets: `crates/diagram-core/presets/` (GOST = default, provisional until the
standard's PDF is applied; Visual Studio; PlantUML). Font choices: Times New Roman
(default), GOST type A, Arial — each a fallback list.
Back-compat: `#[serde(default)]` everywhere, unknown fields ignored, `styleVersion` +
`StyleProfile::migrate` for breaking changes. Files are read through Rust (`read_style`);
the frontend's `normalizeStyle` only fills defaults for localStorage.

## Typst export
`diagram_core::typst::render(diagram, style)` emits a module with
`#let diagram(scale: 100%)`; use `#import "diagram.typ": diagram`. 1 px = 0.75 pt.
Boxes are `place()`d at IR coordinates with IR width/height; rows have fixed heights
(`lineHeight`), so the frontend's `measureClass()` sizes fit both renderers.
Edges: same border clipping and notation as the editor, heads drawn as polygons.

## Project file
`diagramator.json` in the analyzed source folder (`crates/diagram-core/src/project.rs`):
`{ version, output: "diagram.typ", autoExport: true, style: <full profile>, positions: {id: {x, y}} }`.
Opening a folder applies saved positions (by Doxygen refid) and the saved style.
Saves: Ctrl+S, Save button, and autosave 800 ms after drags/style edits
(`src/app/store/autosave.ts`). Each save rewrites the Typst `output` when `autoExport` is on.
Positions of classes that disappeared from the sources are kept.

## Edge routing
`routing.ts` computes every edge's polyline so edges don't cross class boxes:
straight mode = direct line if clear, else shortest path over box corners;
orthogonal mode (style `orthogonalEdges`) = A* on a grid from box borders with bend,
shared-segment and shared-start-port penalties. Runs in a store listener
(`src/app/store/routing.ts`) after load, drop, resize and style changes; while dragging,
edges of the dragged node show a live straight line. Routes are saved in the IR and
exported to Typst as-is.

## Recent projects & examples
Recent list (max 10, removable) in localStorage via `src/app/store/persist.ts`; the latest
reopens on start. `examples/` is bundled as a Tauri resource and copied to
`<app data>/examples/` on first open (install dir is read-only).

## Releases, sidecars, updates
Tag `v*` → `.github/workflows/release.yml` builds installers for all platforms via
`tauri-apps/tauri-action`, after `scripts/fetch-sidecars.mjs` downloads pinned
`doxygen`/`typst` releases into `src-tauri/binaries/` for that job's target triple.
`bundle.externalBin` is injected with `--config` at that point only — not in
`tauri.conf.json` — since Tauri checks the sidecar files exist at build time, and they
aren't committed (`cargo check`/`pnpm tauri dev` keep using `PATH`).
In-app updaters: `tools::check_updates`/`update_tool` (GitHub releases API + sha256
verification) refresh doxygen/typst into `<app data>/tools/`; `tauri-plugin-updater`
(`AppUpdateDialog`) self-updates Diagramator from the same release's signed
`latest.json`. Third-party licenses (doxygen GPL-2.0, typst Apache-2.0) ship under
`licenses/` in the bundle, from `/THIRD_PARTY_LICENSES/`.
