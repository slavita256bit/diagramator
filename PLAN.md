# Plan — next iteration

Order matters: each phase unblocks the next. Blocking env gaps: `pnpm` and `doxygen`
are not installed (`typst 0.15` is).

## 0. Agent docs (AGENTS.md)
There is no CLAUDE.md and no saved memory yet; knowledge lives in README + blueprint.
- `AGENTS.md` = canonical agent guide (short): commands, layout, IR contract, conventions
  (FSD, `source` = dependent side, Rust core has no Tauri dep), "how to verify a change".
- `CLAUDE.md` = one line `@AGENTS.md` (Claude reads it, other agents read AGENTS.md).
- `docs/` for deep topics linked from AGENTS.md, loaded only when needed:
  `docs/architecture.md` (from blueprint), `docs/typst-export.md`, `docs/project-file.md`.
- Delete `blueprint.md` (content moved; done phases dropped). README stays human-facing.

## 1. pnpm
- pnpm 12.6 installed in `~/.local` (done), `pnpm import` → `pnpm-lock.yaml`, delete `package-lock.json`.
- `"packageManager"` field in package.json; `tauri.conf.json` before*Command → `pnpm dev`/`pnpm build`.
- README/AGENTS commands updated.

## 2. Java example
- `examples/java-zoo/` — small package: interface, abstract class, inheritance, composition,
  aggregation, enum, generics. Reuse/extend `crates/diagram-core/tests/fixtures/java`.
- Needs `sudo dnf install doxygen` to run end to end.

## 3. Style profiles (editable, import/export)
- `StyleProfile` JSON, one type in Rust (`ir.rs` sibling `style.rs`) + TS mirror:
  font (default **Times New Roman**; one-click switch to **GOST type A** / **Arial**,
  each with a fallback list), size, line height, padding, border width, colors, header bold/stereotype
  format, abstract = italic, static = underline, arrow sizes, grid snap.
- Back-compat: every profile carries `"styleVersion": N`; Rust uses `#[serde(default)]`
  on every field, so old/partial files load with defaults and unknown fields are ignored;
  breaking changes go through a small `migrate(vN → vN+1)` step. One fixture test per
  released version guarantees old files keep loading.
- Presets: `gost` (provisional: black/white, thin lines — exact rules from the GOST PDF later),
  `visual-studio` (VS class designer: rounded, blue-ish header), `plantuml` (yellow box,
  circled C/I/E badge).
- Settings drawer: pick preset, edit fields, Import/Export `.json` (dialog + Rust read/write
  commands; no new fs plugin).
- The same profile drives the React node (CSS vars) and the Typst generator → visuals match.

## 4. Typst export + test
- `diagram-core/src/typst.rs`: `render(diagram, style) -> String`.
  - Generated file exposes `#let diagram(scale: 100%) = ...` so the user does
    `#import "diagram.typ": diagram` and places it in their main document.
  - Boxes via `place(dx, dy, block(width, height))`, **1 editor px = 0.75pt** (fixed factor),
    width/height taken from the IR.
  - Edges computed in Rust with the same border-clipping as `FloatingEdge.tsx`,
    drawn with `line`/`path` + marker polygons (hollow triangle, diamonds, arrows).
- Tauri command `export_typst(diagram, style, path)`.
- Test: `cargo test` renders fixtures and runs `typst compile` if `typst` is on PATH
  (skipped otherwise); snapshot the .typ text for one fixture.

## 5. Editor ↔ Typst position match
- Root issue: editor box size comes from DOM, Typst box size from the Rust estimate.
- Fix: after React Flow measures nodes, write measured width/height back into the IR
  (`classMeasured`), and Typst uses those exact sizes; both sides use the same font from
  the style profile (bundle/ship the font or pick one both have).
- Visual check: export, compile to PNG, compare to editor screenshot for the example projects.

## 6. Project file + auto-generation on save
- In the analyzed folder: `diagramator.json`
  `{ version, style: <full StyleProfile, inline>, output: "diagram.typ", positions: { classId: {x,y} } }`
  — full style inline so the folder is portable.
- On analyze: load it if present, apply saved positions by class id; new classes get
  auto-layout, removed ones are dropped.
- Save (Ctrl+S + debounced after drag stop): write `diagramator.json` and regenerate
  `diagram.typ` next to it. Toggle "auto-generate on save" in settings (default on).

## 7. Recent projects
- List of `{ path, name, openedAt }` persisted in `localStorage` (Tauri webview keeps it),
  max 10. Menu in toolbar with remove (×) per entry. On startup, reopen the latest one.
- Lazier alternative: just "reopen last" without the list; list is cheap enough though.

## 8. Performance ("feels laggy")
Measure first (React Profiler + dragging on the java/cpp examples), then likely fixes:
- `UmlClassNode`: replace per-member MUI `Typography`+`sx` (Emotion styles per line) with
  plain elements + one CSS class — biggest suspect.
- `onlyRenderVisibleElements` on `<ReactFlow>`; MiniMap off by default (toggle).
- Keep node/edge type maps and handlers stable (`useCallback`), avoid re-render of
  `DiagramCanvas` on store updates unrelated to the graph.

## Decided
- Font: Times New Roman default; GOST type A / Arial switchable.
- `diagramator.json` holds the full style (portable), versioned for back-compat.
- Output `diagram.typ` in the project folder. GOST specifics: wait for user's PDF.
- Agents use `rg` instead of `grep`.
