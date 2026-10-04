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

## 3. Style profiles (editable, import/export) — DONE
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

## 4. Typst export + test — DONE
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

## 5. Editor ↔ Typst position match — DONE (sizes via `measureClass`; verified by screenshot)
- Root issue: editor box size comes from DOM, Typst box size from the Rust estimate.
- Fix: after React Flow measures nodes, write measured width/height back into the IR
  (`classMeasured`), and Typst uses those exact sizes; both sides use the same font from
  the style profile (bundle/ship the font or pick one both have).
- Visual check: export, compile to PNG, compare to editor screenshot for the example projects.

## 6. Project file + auto-generation on save — DONE
New classes (not in the file) get auto-layout positions and may overlap saved ones — place them
next to the saved layout if that bites.
- In the analyzed folder: `diagramator.json`
  `{ version, style: <full StyleProfile, inline>, output: "diagram.typ", positions: { classId: {x,y} } }`
  — full style inline so the folder is portable.
- On analyze: load it if present, apply saved positions by class id; new classes get
  auto-layout, removed ones are dropped.
- Save (Ctrl+S + debounced after drag stop): write `diagramator.json` and regenerate
  `diagram.typ` next to it. Toggle "auto-generate on save" in settings (default on).

## 7. Recent projects + examples menu — DONE
(Also done: edge routing around boxes + orthogonal edges switch, see docs/architecture.md.)
- List of `{ path, name, openedAt }` persisted in `localStorage` (Tauri webview keeps it),
  max 10. Menu in toolbar with remove (×) per entry. On startup, reopen the latest one.
- Lazier alternative: just "reopen last" without the list; list is cheap enough though.

## 8. Performance ("feels laggy") — browser fast, Tauri app slow
Done so far:
- Class node = plain DOM + CSS vars (no per-row MUI/Emotion).
- `onlyRenderVisibleElements`, MiniMap off by default (toggle in Controls), stable drag handler.
- Linux: `WEBKIT_DISABLE_DMABUF_RENDERER=1` was forced on every machine — it pushes WebKitGTK
  to a slow, software-heavy rendering path. Now only on NVIDIA or with `DIAGRAMATOR_DISABLE_DMABUF=1`.
Next if still slow: profile in WebKit inspector (right click → Inspect in `pnpm tauri dev`);
suspects: edge re-renders on drag (FloatingEdge per frame), dotted Background, box-shadow.

## 9. Releases, installers, bundled tools, updates — DONE (except two manual steps below)
- `.github/workflows/release.yml`: tag `v*` → `tauri-apps/tauri-action` matrix (windows-latest,
  ubuntu-22.04, macos-latest arm64 + x86_64) → draft GitHub Release with installers.
  `bundle.externalBin` is injected via `--config` at build time only (not in `tauri.conf.json`,
  or `cargo check`/`pnpm tauri dev` would break — see `src-tauri/binaries/README.md`).
- `scripts/fetch-sidecars.mjs` downloads pinned `doxygen`/`typst` releases per target triple into
  `src-tauri/binaries/` before the CI build; `tools.rs` already looked for sidecars next to the
  executable.
- In-app tool updates: `tools::check_updates`/`update_tool` hit each tool's GitHub releases API,
  verify the downloaded asset against GitHub's `sha256:` digest, install into `<app data>/tools/`;
  `ToolStatusChips` shows an update icon and installs on click.
- App self-update: `tauri-plugin-updater` wired in, `AppUpdateDialog` checks on launch. **Needs a
  one-time manual step**: run `pnpm tauri signer generate -w src-tauri/updater.key`, put the
  printed public key into `tauri.conf.json`'s `plugins.updater.pubkey` (currently a placeholder),
  and add `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub repo secrets
  (not done by the agent — credential handling).
- Licenses: MIT `/LICENSE` for Diagramator; `/THIRD_PARTY_LICENSES/` has doxygen's GPL-2.0 and
  typst's Apache-2.0 texts, shipped into the bundle under `licenses/`.
- Still deferred, needs certs: macOS notarization, Windows code-signing (unsigned installers will
  show Gatekeeper/SmartScreen warnings until then).

## Decided
- Font: Times New Roman default; GOST type A / Arial switchable.
- `diagramator.json` holds the full style (portable), versioned for back-compat.
- Output `diagram.typ` in the project folder. GOST specifics: wait for user's PDF.
- Agents use `rg` instead of `grep`.
