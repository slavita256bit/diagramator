# Sidecar binaries

Populated by `scripts/fetch-sidecars.mjs` in CI (`.github/workflows/release.yml`), not
committed. It downloads the pinned `doxygen`/`typst` releases and writes them here as
Tauri expects, platform-suffixed and **`diagramator-` prefixed**:

    diagramator-doxygen-x86_64-unknown-linux-gnu
    diagramator-doxygen-x86_64-pc-windows-msvc.exe
    diagramator-typst-aarch64-apple-darwin

The prefix matters: Linux packaging (.deb/.rpm/AppImage) installs `externalBin` entries
into the same directory as the main executable — i.e. straight into `/usr/bin` for
.deb/.rpm — so a plain `doxygen`/`typst` name collided with the system `doxygen` package
(`rpm` refused to install: file conflict on `/usr/bin/doxygen`). `tools.rs`'s
`bundled_file_name()` looks for the prefixed name next to the executable; its plain
`file_name()` is still what's checked on `PATH` and in `<app data>/tools/`.

`bundle.externalBin` is **not** in `tauri.conf.json` itself — Tauri's build script
checks at compile time that every `externalBin` entry exists on disk, and these files
aren't committed, so declaring it there would break `cargo check`/`pnpm tauri dev` for
everyone. `.github/workflows/release.yml` injects the generated
`src-tauri/binaries/sidecars.conf.json` for release builds. It includes both `externalBin`
entries and the existing application resources. On Windows it additionally maps every DLL
shipped alongside Doxygen (notably `libclang.dll`) into the install directory beside the
EXE. Copying just `doxygen.exe` makes Windows require a separate LLVM installation.

The fetch script checks `--version` for both tools and actually generates class XML with
Doxygen. On Windows its smoke-test PATH contains only System32, preventing LLVM already
installed on CI from hiding a missing DLL. The same runtime DLLs are preserved by the
in-app tool updater; incomplete overrides left by older updates are skipped.

Local dev (`pnpm tauri dev`) doesn't need this folder at all — it keeps resolving
`doxygen`/`typst` from `PATH` (see `src-tauri/src/tools.rs`). Run
`node scripts/fetch-sidecars.mjs --triple <your-triple>` here, then add the same
`--config src-tauri/binaries/sidecars.conf.json` to `pnpm tauri build`, only if you want to test a release-style build
locally.
