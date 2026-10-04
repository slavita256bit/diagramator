# Sidecar binaries

Populated by `scripts/fetch-sidecars.mjs` in CI (`.github/workflows/release.yml`), not
committed. It downloads the pinned `doxygen`/`typst` releases and writes them here as
Tauri expects, platform-suffixed:

    doxygen-x86_64-unknown-linux-gnu
    doxygen-x86_64-pc-windows-msvc.exe
    typst-aarch64-apple-darwin

`bundle.externalBin` is **not** in `tauri.conf.json` itself — Tauri's build script
checks at compile time that every `externalBin` entry exists on disk, and these files
aren't committed, so declaring it there would break `cargo check`/`pnpm tauri dev` for
everyone. `.github/workflows/release.yml` injects it only for release builds, via
`tauri build --config '{"bundle":{"externalBin":["binaries/doxygen","binaries/typst"]}}'`,
after `fetch-sidecars.mjs` has populated this folder.

Local dev (`pnpm tauri dev`) doesn't need this folder at all — it keeps resolving
`doxygen`/`typst` from `PATH` (see `src-tauri/src/tools.rs`). Run
`node scripts/fetch-sidecars.mjs --triple <your-triple>` here, then add the same
`--config` above to `pnpm tauri build`, only if you want to test a release-style build
locally.
