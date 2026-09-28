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

## Planned (see PLAN.md)
- Typst export: absolute `place()` from IR coordinates, 1 px = 0.75 pt.
- Style profile JSON (versioned, full style inline) shared by editor and Typst.
- `diagramator.json` in the project folder: style + positions; `diagram.typ` regenerated on save.
- Tool updater: download newer doxygen/typst releases into `<app data>/tools/`.
