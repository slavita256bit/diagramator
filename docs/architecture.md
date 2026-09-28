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

## Planned (see PLAN.md)
- `diagramator.json` in the project folder: style + positions; `diagram.typ` regenerated on save.
- Tool updater: download newer doxygen/typst releases into `<app data>/tools/`.
