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
cargo test -p diagram-core     # parser/IR tests (skip if doxygen missing)
cargo run -p diagram-core --example analyze -- examples/java-library
```
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
- Saved files (style profiles, `diagramator.json`) are versioned; new fields need
  `#[serde(default)]`; old files must keep loading. See `docs/architecture.md`.

## Conventions
- Smallest change that works; reuse before adding; no new deps without reason.
- Business logic in Rust core when it must match Typst output (layout, edge geometry).

## Docs index
- `docs/architecture.md` — stack, IR, data flow, file formats.
