#!/usr/bin/env node
// Downloads pinned doxygen/typst releases and installs them as Tauri sidecars
// (`src-tauri/binaries/<name>-<target-triple>[.exe]`). CI-only — local `pnpm tauri dev`
// still resolves both tools from `PATH` (see `src-tauri/src/tools.rs`).
//
// Usage: node scripts/fetch-sidecars.mjs --triple <target-triple>

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, statSync, copyFileSync, chmodSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const DOXYGEN_TAG = "Release_1_18_0";
const DOXYGEN_VERSION = "1.18.0";
const TYPST_TAG = "v0.15.1";

const ASSETS = {
  "x86_64-unknown-linux-gnu": {
    doxygen: `doxygen-${DOXYGEN_VERSION}.linux.bin.tar.gz`,
    typst: "typst-x86_64-unknown-linux-musl.tar.xz",
  },
  "x86_64-pc-windows-msvc": {
    doxygen: `doxygen-${DOXYGEN_VERSION}.windows.x64.bin.zip`,
    typst: "typst-x86_64-pc-windows-msvc.zip",
  },
  "aarch64-apple-darwin": {
    doxygen: `doxygen-${DOXYGEN_VERSION}-mac-arm.zip`,
    typst: "typst-aarch64-apple-darwin.tar.xz",
  },
  "x86_64-apple-darwin": {
    doxygen: `doxygen-${DOXYGEN_VERSION}-mac-intel.zip`,
    typst: "typst-x86_64-apple-darwin.tar.xz",
  },
};

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const binariesDir = join(repoRoot, "src-tauri", "binaries");

function parseArgs() {
  const i = process.argv.indexOf("--triple");
  const triple = i !== -1 ? process.argv[i + 1] : undefined;
  if (!triple || !ASSETS[triple]) {
    throw new Error(`--triple must be one of: ${Object.keys(ASSETS).join(", ")} (got ${triple})`);
  }
  return triple;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function extract(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (archivePath.endsWith(".zip") && process.platform !== "win32") {
    execFileSync("unzip", ["-q", archivePath, "-d", destDir]);
  } else {
    // GNU/BSD `tar` both auto-detect gzip/xz, and Windows' bundled bsdtar also handles zip.
    execFileSync("tar", ["-xf", archivePath, "-C", destDir]);
  }
}

/** Recursively finds the first regular file named exactly `name` under `dir`. */
function findBinary(dir, name) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      const found = findBinary(p, name);
      if (found) return found;
    } else if (basename(p) === name) {
      return p;
    }
  }
  return null;
}

async function fetchTool(toolName, owner, repo, tag, asset, triple) {
  const work = mkdtempSync(join(tmpdir(), `${toolName}-`));
  try {
    const archivePath = join(work, asset);
    const url = `https://github.com/${owner}/${repo}/releases/download/${tag}/${asset}`;
    console.log(`[fetch-sidecars] ${url}`);
    await download(url, archivePath);

    const extractDir = join(work, "extracted");
    extract(archivePath, extractDir);

    const exeName = triple.includes("windows") ? `${toolName}.exe` : toolName;
    const found = findBinary(extractDir, exeName) ?? findBinary(extractDir, toolName);
    if (!found) throw new Error(`could not find "${toolName}" binary inside ${asset}`);

    mkdirSync(binariesDir, { recursive: true });
    // "diagramator-" prefix: Linux packaging (.deb/.rpm/AppImage) installs externalBin
    // entries into the same directory as the main executable, so a plain "doxygen"/"typst"
    // name would collide with the system doxygen package (rpm refused to install over
    // /usr/bin/doxygen). Must match `bundled_file_name()` in src-tauri/src/tools.rs.
    const destName = `diagramator-${toolName}-${triple}${triple.includes("windows") ? ".exe" : ""}`;
    const dest = join(binariesDir, destName);
    copyFileSync(found, dest);
    if (process.platform !== "win32") chmodSync(dest, 0o755);

    // Sanity-check the binary actually runs before trusting it into a release — catches a
    // truncated/corrupted download or a wrong-arch extraction silently producing a dead sidecar.
    try {
      execFileSync(dest, ["--version"], { stdio: "pipe" });
    } catch (e) {
      throw new Error(`downloaded ${toolName} doesn't run (${asset}): ${e.message}`);
    }
    console.log(`[fetch-sidecars] wrote ${dest}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const triple = parseArgs();
const asset = ASSETS[triple];
await fetchTool("doxygen", "doxygen", "doxygen", DOXYGEN_TAG, asset.doxygen, triple);
await fetchTool("typst", "typst", "typst", TYPST_TAG, asset.typst, triple);
