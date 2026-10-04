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
everyone. `.github/workflows/release.yml` injects it only for release builds, via
`tauri build --config '{"bundle":{"externalBin":["binaries/diagramator-doxygen","binaries/diagramator-typst"]}}'`,
after `fetch-sidecars.mjs` has populated this folder.

Local dev (`pnpm tauri dev`) doesn't need this folder at all — it keeps resolving
`doxygen`/`typst` from `PATH` (see `src-tauri/src/tools.rs`). Run
`node scripts/fetch-sidecars.mjs --triple <your-triple>` here, then add the same
`--config` above to `pnpm tauri build`, only if you want to test a release-style build
locally.
