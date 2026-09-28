# AGENTS.md

Guide for coding agents (Claude reads it via `CLAUDE.md`). Keep it short; deep
topics live in `docs/` — read them only when the task touches that area.

## What this is
Tauri v2 desktop app: runs Doxygen over C++/Java sources → diagram IR (JSON) →
interactive UML class diagram (React Flow) → Typst export. Roadmap: `PLAN.md`.

## Commands
```sh
pnpm install
pnpm tauri dev                 # desktop app, hot reload
pnpm dev                       # UI only in browser, sample data, no Rust
pnpm build                     # typecheck + frontend build  ← run after TS changes
pnpm test                      # TS unit tests (*.test.ts, node --test)
cargo test -p diagram-core     # parser/IR tests (skip if doxygen missing)
cargo run -p diagram-core --example analyze -- examples/java-library
cargo run -p diagram-core --example typst -- [style.json] < ir.json > diagram.typ
```
`cargo test` also renders every style preset with real `typst` into
`target/typst-preview/<preset>.png` — look at them after exporter changes.
Tools: `pnpm` (not npm), `rg` (not grep). Needs `doxygen` on PATH; `typst` for export tests.

## Layout
- `crates/diagram-core/` — Tauri-free core: IR, Doxygen runner/XML parser, auto-layout. Test here.
- `src-tauri/` — thin shell: commands (`commands.rs`), tool lookup (`tools.rs`).
- `src/` — frontend, Feature-Sliced Design: `app → pages → widgets → features → entities → shared`
  (import only downward).
- `examples/` — `cpp-shop`, `java-library`: manual test projects.

## Contracts (don't break silently)
- IR: `crates/diagram-core/src/ir.rs` ↔ `src/shared/types/diagram.ts` — change both.
- Relation `source` is always the dependent side (child, whole, user).
- Style profile: `crates/diagram-core/src/style.rs` ↔ `src/shared/types/style.ts`.
  Presets live once in `crates/diagram-core/presets/*.json` (imported by both sides).
  Versioned (`styleVersion`); new fields need `#[serde(default)]` + a default in the
  presets; old files must keep loading (tests in `style.rs`).
- Editor ↔ Typst geometry must match: fixed row heights, box size from
  `measureClass()` (`src/entities/diagram/lib/measure.ts`), same edge clipping and
  relation notation in `toFlow.ts` and `typst.rs`. Edge geometry is computed once by the
  TS router (`src/entities/diagram/lib/routing.ts`) into `Relation.route`; Typst only draws it.

## Conventions
- Smallest change that works; reuse before adding; no new deps without reason.
- Business logic in Rust core when it must match Typst output (layout, edge geometry).

## Docs index
- `docs/architecture.md` — stack, IR, data flow, style profiles, Typst export.
