import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyWindowsRuntime, sidecarBundleConfig, smokeEnvironment } from "./sidecar-files.mjs";

test("Windows packaging retains DLLs and includes them beside the installed sidecar", () => {
  const dir = mkdtempSync(join(tmpdir(), "diagramator-sidecar-test-"));
  try {
    const upstream = join(dir, "upstream"), output = join(dir, "binaries");
    mkdirSync(upstream);
    const exe = join(upstream, "doxygen.exe");
    writeFileSync(exe, "EXE");
    writeFileSync(join(upstream, "libclang.dll"), "CLANG");
    writeFileSync(join(upstream, "extra.DLL"), "RUNTIME");
    writeFileSync(join(upstream, "doxywizard.exe"), "UNUSED");
    const files = copyWindowsRuntime(exe, output, true);
    assert.deepEqual(files.sort(), ["extra.DLL", "libclang.dll"]);
    assert.equal(readFileSync(join(output, "libclang.dll"), "utf8"), "CLANG");
    const baseResources = { "../examples/": "examples/", "../THIRD_PARTY_LICENSES/": "licenses/" };
    const config = sidecarBundleConfig(baseResources, files);
    assert.equal(config.bundle.resources["binaries/libclang.dll"], "libclang.dll");
    assert.equal(config.bundle.resources["../examples/"], "examples/");
    assert.equal(config.bundle.resources["../THIRD_PARTY_LICENSES/"], "licenses/");
    assert.equal(config.bundle.externalBin.length, 2);
    assert.deepEqual(sidecarBundleConfig(baseResources).bundle.resources, baseResources, "non-Windows has no DLL resources");
    rmSync(join(upstream, "libclang.dll"));
    assert.throws(() => copyWindowsRuntime(exe, output, true), /missing libclang.dll/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("Windows smoke tests cannot accidentally find LLVM on the CI runner PATH", () => {
  const env = { Path: "C:\\LLVM\\bin", PATH: "C:\\other-llvm", SystemRoot: "C:\\Windows", TEMP: "temp" };
  const clean = smokeEnvironment(env, "win32");
  assert.equal(Object.keys(clean).filter((key) => key.toUpperCase() === "PATH").length, 1);
  assert.ok(!clean.PATH.includes("LLVM") && !clean.PATH.includes("llvm"));
  assert.equal(clean.TEMP, env.TEMP);
  assert.deepEqual(smokeEnvironment(env, "linux"), env);
});
