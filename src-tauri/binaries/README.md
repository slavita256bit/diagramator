# Sidecar binaries

Tauri `externalBin` expects platform-suffixed executables here, e.g.

    doxygen-x86_64-unknown-linux-gnu
    doxygen-x86_64-pc-windows-msvc.exe
    typst-aarch64-apple-darwin

They are not committed. Once they are present, add
`"externalBin": ["binaries/doxygen", "binaries/typst"]` to `bundle` in
`tauri.conf.json`. Until then the app falls back to `doxygen`/`typst` on `PATH`
(see `src/tools.rs` for the lookup order).
