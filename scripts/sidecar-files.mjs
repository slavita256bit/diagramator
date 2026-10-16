import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** Keep the DLLs shipped beside the official Windows EXE, rather than copying only the EXE. */
export function copyWindowsRuntime(binary, destDir, requireClang = false) {
  const files = readdirSync(dirname(binary), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".dll"))
    .map((entry) => entry.name);
  if (requireClang && !files.some((name) => name.toLowerCase() === "libclang.dll")) {
    throw new Error("Windows Doxygen archive is missing libclang.dll");
  }
  mkdirSync(destDir, { recursive: true });
  for (const name of files) copyFileSync(join(dirname(binary), name), join(destDir, name));
  return files;
}

export function sidecarBundleConfig(resources, runtimeFiles = []) {
  return { bundle: {
    externalBin: ["binaries/diagramator-doxygen", "binaries/diagramator-typst"],
    resources: { ...resources, ...Object.fromEntries(runtimeFiles.map((name) => [
      `binaries/${basename(name)}`, basename(name),
    ])) },
  } };
}

/** Windows CI has LLVM on PATH; exclude it so it cannot mask an incomplete sidecar. */
export function smokeEnvironment(env, platform) {
  if (platform !== "win32") return { ...env };
  const clean = Object.fromEntries(Object.entries(env).filter(([key]) => key.toUpperCase() !== "PATH"));
  clean.PATH = join(env.SystemRoot ?? env.SYSTEMROOT ?? "C:\\Windows", "System32");
  return clean;
}
