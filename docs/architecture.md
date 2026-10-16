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
    "templateParams": [], "attributesCollapsed": false, "methodsCollapsed": false,
    "position": { "x": 100, "y": 200, "width": 150, "height": 80 } }],
  "relations": [{ "source": "c1", "target": "c2", "type": "inheritance" }],
  "notes": [{ "id": "n1", "text": "...", "position": { ... }, "linkedClass": "c1" }]
}
```
`kind`: class | struct | interface | enum | union (UML stereotypes).
`type`: inheritance | realization | composition | aggregation | association | dependency.
`templateParams`: generic/template parameter names (GOST fig 4.5 / PlantUML `template<...>`),
parsed from Doxygen's `templateparamlist` (`doxygen/parser.rs`) but kept out of `name` —
rendering (corner box vs. header row vs. none) is a style choice, see below.
`hidden`: optional per-class boolean (default false); hides a class and incident relations
from the canvas, routing obstacles, and Typst export without removing its data or position.
Select a class to hide it; the toolbar visibility list restores it.
`notes`: freestanding comment boxes (not from Doxygen); optionally linked to one class with
a dashed connector. Round-trip through `diagramator.json` like positions, not through Doxygen.

## Style profiles
JSON profile (font list, sizes, paddings, colors, badge, edge/arrow sizes, member icons,
template notation, section visibility), lengths in editor px. Presets:
`crates/diagram-core/presets/` (GOST = default; Visual Studio; PlantUML). Font choices:
Times New Roman (default), GOST type A, Arial — each a fallback list.
Notable style-driven behavior (not just appearance):
- `interfaceHidesAttributes`: GOST interfaces omit the attributes compartment entirely
  (not just empty) — per the standard's text, the methods section still always shows,
  even empty, marked by its divider line.
- Section collapse (attributes/methods, independently, per class) measures/renders
  **exactly like an empty section** — no separate height/layout logic; the chevron toggle
  itself is editor-only UI and doesn't appear in the exported document.
- `memberIconStyle`: `text` (GOST's plain +/-/#), `shape` (VS-style, circle/square by
  access), `circle` (PlantUML-style) — access-level colors are a fixed convention
  (`visibility_color` in `typst.rs`, `VIS_COLOR` in `measure.ts`), not user-customizable.
- `showMethodParams`/`showMethodReturnType`: method-signature verbosity, applied by
  `format_method`/`formatMethodSignature` (duplicated TS+Rust like the `{static}`/
  `{abstract}` tag convention already was).
Back-compat: `#[serde(default)]` everywhere, unknown fields ignored, `styleVersion` +
`StyleProfile::migrate` for breaking changes (pure additions, like most fields above, don't
need a migrate step — the hand-written `Default impl` already backfills them). Files are
read through Rust (`read_style`); the frontend's `normalizeStyle` only fills defaults for
localStorage.

## Typst export
`diagram_core::typst::render(diagram, style)` emits a module with
`#let diagram(scale: 100%)`; use `#import "diagram.typ": diagram`. 1 px = 0.75 pt.
Boxes are `place()`d at IR coordinates with IR width/height; rows have fixed heights
(`lineHeight`), so the frontend's `measureClass()` sizes fit both renderers.
Edges: same border clipping and notation as the editor, heads drawn as polygons; dash
pattern comes from `edgeDashLength`/`edgeDashGap` (also used for note connectors and the
GOST template corner box's border). Template corner boxes sit outside the class box's own
bounding box — not counted in `measureClass`/React Flow layout, since it's a decorative
overlay — so the Typst bbox computation adds a per-class margin term for them, the same way
self-loop arrows already do.

## Project file
`diagramator.json` in the analyzed source folder (`crates/diagram-core/src/project.rs`):
`{ version, output: "diagram.typ", autoExport: true, style: <full profile>,
positions: {id: {x, y}}, hidden: {id: boolean}, collapsed: {id: {attributes, methods}}, notes: [...] }`.
Opening a folder applies saved positions/collapse state (by Doxygen refid) and restores
notes verbatim (they aren't Doxygen-sourced, so there's nothing to id-match them against).
Saves: Ctrl+S, Save button, and autosave 800 ms after drags/style edits/collapse/visibility/notes
(`src/app/store/autosave.ts`). Each save rewrites the Typst `output` when `autoExport` is on.
Positions/collapse state of classes that disappeared from the sources are kept.

## Edge routing
`routing.ts` computes every edge's polyline so edges don't cross class boxes:
straight mode = direct line if clear, else shortest path over box corners;
orthogonal mode (style `orthogonalEdges`) = A* on a grid from box borders with bend,
shared-segment penalties. Orthogonal relations leave the source top and enter the target
bottom, including self-loops. Multiple connections use ports ordered by the other endpoint's position.
`edgeMergeTargets` shares a trunk and endpoint for compatible incoming arrows (enabled
by default); disabling it separates the ports. Source/target sides, box clearance,
port spacing and bend penalty are configurable. The same router runs while moving boxes.
`edgeEditable` enables blue endpoint handles on a selected orthogonal relation. Dragging
snaps to a block side and records `anchors: {source?, target?}` with `{side, offset}`;
offset is a fraction along the side, so resizing keeps the attachment. Double-clicking a
handle restores automatic placement. Dragged endpoints gently snap to 25%, 50% and 75%
of a side (up to 6 screen pixels, capped at 4% of side length); Shift locks to the nearest
of these stops. Project `connections` restores anchors by source,
target and relation type after Doxygen analysis. Typst draws the resulting route verbatim
and includes route extents in its bounds. Runs in a store listener
(`src/app/store/routing.ts`) after load, drop, resize and style changes. During dragging,
the same routing geometry is recomputed asynchronously for the current node positions. Routes are saved in the IR and
exported to Typst as-is.

## Recent projects & examples
Recent list (max 10, removable) in localStorage via `src/app/store/persist.ts`; the latest
reopens on start. `examples/` is bundled as a Tauri resource and copied to
`<app data>/examples/` on first open (install dir is read-only).

## Releases, sidecars, updates
Tag `v*` → `.github/workflows/release.yml` builds installers for all platforms via
`tauri-apps/tauri-action`, after `scripts/fetch-sidecars.mjs` downloads pinned
`doxygen`/`typst` releases into `src-tauri/binaries/` for that job's target triple.
`bundle.externalBin` is injected using the generated `binaries/sidecars.conf.json` at that point only — not in
`tauri.conf.json` — since Tauri checks the sidecar files exist at build time, and they
aren't committed (`cargo check`/`pnpm tauri dev` keep using `PATH`).
In-app updaters: `tools::check_updates`/`update_tool` (GitHub releases API + sha256
verification) refresh doxygen/typst into `<app data>/tools/`; `tauri-plugin-updater`
(`AppUpdateDialog`) self-updates Diagramator from the same release's signed
`latest.json`. Third-party licenses (doxygen GPL-2.0, typst Apache-2.0) ship under
`licenses/` in the bundle, from `/THIRD_PARTY_LICENSES/`.

## Background routing and app themes
`computeRoutesAsync` sends visible boxes, manual anchors, relation kinds and routing options
to `routing.worker.ts`. A single-flight queue drops cancelled drag requests before they reach
the worker; stale results never update the canvas or store. Worker startup/runtime failures
fall back to the same synchronous router. Save and export await geometry for their snapshot.
The canvas uses asynchronous routing while dragging, keeping the same merged connections.

App themes (Light, Dark, Nord, Solarized) live in `shared/config/themes.ts`, selected through
the toolbar menu and persisted as `diagramator.theme`. They style the app chrome and a light
canvas background; diagram/profile colors and Typst output are independent of the app theme.

Windows Doxygen requires the `libclang.dll` supplied in its official binary archive.
The sidecar fetch script preserves sibling DLLs and the generated Tauri resource mapping
installs them next to the EXE. CI probes both version and XML generation with LLVM removed
from PATH. The tool updater copies those DLLs too and validates the extracted tool before
replacing it. Lookup skips incomplete Windows Doxygen overrides created by older updates.

Release preparation and tag publication are described in [releasing.md](releasing.md).
The two-step helper stages version files, requires a manual commit, and then pushes the
committed branch and annotated release tag without creating a commit.
