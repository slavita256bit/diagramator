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
- Routing now uses a Web Worker with cancellation for obsolete drag frames and a synchronous
  fallback. Save/export await current geometry; no fresh WebKitGTK timing claim yet.
- App themes: Light, Dark, Nord, Solarized, with a persisted toolbar picker and a light canvas.
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

## 10. Refresh projects after external edits — deferred

- Watch the open project's `diagramator.json` and the C++ headers, C++ sources, and
  Java sources that Doxygen analyzes. Debounce changes from editors and batch tools.
- Reload settings and visibility from JSON. Re-run analysis for source changes and
  restore the saved layout, notes, and connection settings by identity.
- Treat refresh as a read operation. Keep the last good canvas while a file is
  temporarily invalid and keep externally edited files intact.
- Compare the last loaded or saved JSON revision at save time, including on autosave.
  Ignore the app's own writes. If external edits and unsaved GUI edits overlap,
  preserve the GUI edits in memory, pause autosave, and offer an explicit resolution.
- Verify external edits to both inputs, rapid saves, invalid JSON, and edits arriving
  just before autosave. Decide the conflict resolution UI before implementing.

## 11. GUI editor for BSUIR flowcharts — prototype implemented

Start with the course project's `drawings/order-flow.typ` and
`drawings/filter-flow.typ`. Their Typst calls describe blocks, ports, routes, labels,
and comments. `drawings/classes.typ` is already generated by Diagramator and stays
in the existing UML workflow.

1. Define a small, versioned JSON flowchart format in millimeters. Store stable IDs,
   block type and text, canvas dimensions, port references, optional manual bends,
   explicit junctions, branch labels, connector pairs, and attached comments.
   Keep Typst as the renderer via a small wrapper around `bsuir-core`. Preserve
   the existing `order-flow()` and `filter-flow()` imports in the report. Initial
   TypeScript model and Typst wrapper are in `examples/flowcharts/` and
   `src/shared/types/flowchart.ts`; inline rich text remains to be designed.
2. Convert the order drawing once on a copy. Preserve its positions, branch labels,
   junctions and comments. The current source has no continuation pair. Check that it renders like the
   original before building the editor. Preserve inline Typst formatting such as
   the filter drawing's smaller function name when converting the second drawing.
   The order copy now renders identically at 144 PPI; the report still uses the original.
3. Add a flowchart mode in Diagramator. Reuse canvas selection, zoom, and undo/redo.
   Add a block palette and controls for moving blocks, changing labels and shape
   types, connecting ports, dragging bends, and placing comments. Save the JSON
   and provide a Typst preview.
4. Add obstacle-aware orthogonal routing on top of that model. Moving a block
   updates connected ports and affected routes. Keep manual bends, junctions, and
   label placements until the user resets them. Offer automatic layout for a selected
   group after manual editing works.
5. Validate against the course rules and compile the full report. Check fixed block
   sizes, label fit, decision outcomes, one matching continuation pair at most,
   routes around blocks and comments, and fit within the appendix page. Verify
   both original drawings and a round trip with a new block.

The bounded editor is feasible. The renderer and canvas already exist. The main
work is preserving route and label intent when blocks move and keeping the printed
page legible. Importing and round-tripping arbitrary hand-written Typst is a
separate, substantially harder project and is outside the first version.

### Next passes after reviewing the editor

1. **P0 — Keep edited schemes renderable.** Separate saved manual constraints
   from generated elbows. A reproduced move of the example's start block out and
   back leaves four route points where the original had two. Touching blocks can
   produce consecutive identical port coordinates that pass JSON validation and
   fail a `bsuir-core` assertion. Bend coordinate edits and block type changes
   bypass the routing rules, so an orthogonal path can become diagonal. Use one
   geometry path for all edits and validate the resolved output before preview.
   Keep incomplete drafts editable and report the affected connection. Verify
   round-trip moves, touching ports, type changes, and a Typst compile after edits.
   Implemented: resolved elbows are derived in both the editor and Typst, saved
   route points stay unchanged during moves, and fully coincident routes show a
   warning. Round-trip moves and coincident ports are covered by tests, and an
   edited example compiles. Remaining: verify type changes and broader renderer
   parity, including partially coincident bends and manual junctions.
2. **P0 — Protect open and save.** File actions can overlap, and the desktop
   writer directly replaces the contents without checking for external changes.
   Scope async results to the current document, track the last saved revision,
   and use atomic writes with a conflict check. Offer Save As on conflict. Guard
   replacing or closing an unsaved document, and keep mode switching reversible.
   Verify delayed saves, external edits, failed writes, and canceling dialogs.
3. **P1 — Separate the editor's responsibilities.** The flowchart editor
   component owns SVG rendering, gestures, inspector, file actions, and duplicated
   state in refs. Split the canvas, inspector, document/history, and file handling
   behind the flowchart feature boundary. Keep drag previews separate from the
   committed document, commit one edit on release, and cancel a canceled gesture.
   Derive dirty state from the last saved document, group text edits, and route
   Ctrl+S, undo, and redo to the active workspace. Verify that switching modes
   preserves both documents and their histories.
4. **P1 — Make the editor usable beyond the demo.** Add New, fit and zoom,
   canvas size controls, keyboard selection, and wider edge hit areas. Add port
   selection, draggable bends, and editable comment dimensions. Replace loose
   junction coordinates and independent branch labels with references that
   follow their connections while retaining manual offsets. Add obstacle-aware
   routing after preserving those manual choices.
5. **P1 — Close the Typst loop.** The SVG editor uses a fixed text size, draws
   unwrapped text, and ignores label width. Use the chart settings for the
   editing view and provide an actual Typst preview for print checks. Support
   the filter drawing's inline formatting as structured data, convert a copy,
   and compare both drawings in the full report. Keep the order example's
   current rendering as the baseline.

### Editing and course-project rollout

Implement these passes in order. This supersedes the order of the earlier
prototype review where the two lists overlap.

Use the class-diagram workspace as the interaction reference for selection,
connection handles, undo feedback, and file controls. Add a separate Recent
Block Schemes menu modeled on Recent Projects. Persist successful opens and
saves, show the filename with its folder, and allow removing missing or
unwanted entries without affecting the UML recent list.

1. **Reproduce the Linux rendering warning.** Use the order example and isolate
   whether the pixman warning appears on opening the editor, switching modes,
   selecting a connection, or dragging. Log the active SVG viewport and pointer
   transform, and compare the desktop and browser paths. On Linux, compare with
   the existing `DIAGRAMATOR_DISABLE_DMABUF=1` option. The log alone does not
   identify a cause. If the editor uses invalid geometry, fix it at the source
   and ignore gestures with a missing or non-invertible transform. Verify the
   original sequence again before calling the warning fixed.
2. **Make dragging, connections, and labels predictable.** The current router
   adds elbows around points fixed on the page, and its default new connection
   uses bottom-to-top ports even for blocks side by side. The target selector
   also retains its value when you select a different source. Replace that
   workflow with a Connect tool that lets you pick two ports on the canvas.
   Suggest facing ports by default and show a preview before committing.
   Add wider hit areas, draggable orthogonal segments, and endpoint handles
   for reconnecting. Keep user-placed bends as constraints, resolve shared
   junctions from a single reference, and route around blocks and comments.
   Attach labels to a block port with a draggable offset. Decision labels also
   identify the outgoing connection so “Да” and “Нет” follow the correct branch.
   Keep drag previews separate from committed state and record one undo step per
   gesture. Verify side-by-side blocks, return loops, shared merges, and moves
   out and back. Give invalid routes an actionable warning and keep the draft.
3. **Simplify block controls and fit text.** Use an Add Block menu whose
   choices place a block. Show the single Type field for the selected block.
   Wrap text within each symbol's usable area, and flag text that still
   overflows while keeping the BSUIR symbol sizes fixed. Keep an editable
   comment width and derive its height from wrapped text and padding. Update
   the bracket, leader, and routing obstacle together. Compare the GUI and
   actual Typst output with short, long, multiline, and Cyrillic text.
   If needed, extend `bsuir-core` with opt-in measured comment height and
   shared geometry helpers. Preserve existing constructors, explicit comment
   heights, and old report output. Carry plain text and bounded inline styling
   in JSON, including the 7 pt function name in the filter drawing.
4. **Keep JSON and Typst paired as you edit.** Use one directory and one
   filename stem, for example `order-flow.json` and `order-flow.typ`.
   Keep JSON as the source of truth and generate an importable Typst wrapper.
   After the first Save As establishes the pair, debounce regeneration after
   committed GUI edits and undo/redo. Generate from the same revision as the
   saved JSON. Serialize writes, check both files against their known revisions,
   and preserve external edits by pausing on conflict. Stage both outputs
   before replacing them, handle partial failure explicitly, and retain the
   last renderable output if the new draft cannot compile. Show which revision
   was saved or exported. Verify rapid edits, rename/Save As, conflicts, and
   recovery after a failed write. Update the Typst file before reporting a
   successful export, even if the wrapper itself is identical.
5. **Back up and remake the course drawings after the editor passes those
   checks.** In the course project's `drawings/` directory, target
   `order-flow.json` / `order-flow.typ` and
   `filter-flow.json` / `filter-flow.typ`. Treat `classes.typ` as a separate
   UML export. Render the current appendices as a baseline and make verified,
   dated copies of the original flowchart Typst files and any report source
   that needs editing. Convert the latest originals on a staging copy and
   preserve the report's `order-flow()` and `filter-flow()` functions.
   Compile staged `main.typ`, compare both appendix pages, and follow every
   branch, loop return, and continuation. Verify that each staged pair can be
   opened, edited, regenerated, and compiled. Install the pairs only after
   those checks, then compile the report again. Restore the original Typst
   sources from the backups if the final report fails verification.

Delivered: port-to-port connections, movable segments, block and branch label
anchors, shared junctions in the course drawings, comment sizing, Recent, and
debounced paired desktop saves. The order and filter drawings were converted
and their 100 DPI appendix renders matched the original pages. The original
Typst files and checksums are in the course drawings' dated backup directory.
No library change was needed.

Follow-up verification: reproduce the pixman diagnostic in the desktop session
where it occurred. The editor now guards pointer transforms and mounts the SVG
only in block-scheme mode. The font metrics in the SVG editor are approximate.

## Decided
- Font: Times New Roman default; GOST type A / Arial switchable.
- `diagramator.json` holds the full style (portable), versioned for back-compat.
- Output `diagram.typ` in the project folder. GOST specifics: wait for user's PDF.
- Agents use `rg` instead of `grep`.
