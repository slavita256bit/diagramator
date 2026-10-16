#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const VERSION_FILES = ["package.json", "src-tauri/tauri.conf.json", "Cargo.toml", "Cargo.lock"];
const OWN_PACKAGES = new Set(["diagram-core", "diagramator"]);

function git(root, args, allowFailure = false) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr || result.stdout}`);
  }
  return result;
}

function versionNumber(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
    throw new Error("Use a stable version such as 0.4.7 (without the v prefix).");
  }
  return version.split(".").map(BigInt);
}

function versions(files) {
  const pkg = JSON.parse(files["package.json"]).version;
  const tauri = JSON.parse(files["src-tauri/tauri.conf.json"]).version;
  const cargo = files["Cargo.toml"].match(/^\[workspace\.package\]\s*\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1]
    .match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!cargo) throw new Error("Could not find workspace.package.version in Cargo.toml.");
  const found = { "package.json": pkg, "src-tauri/tauri.conf.json": tauri, "Cargo.toml": cargo };
  for (const block of files["Cargo.lock"].split(/(?=^\[\[package\]\]\r?$)/m)) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    if (!OWN_PACKAGES.has(name)) continue;
    if (/^source = /m.test(block)) throw new Error(`Unexpected external Cargo package: ${name}`);
    found[`Cargo.lock:${name}`] = block.match(/^version = "([^"]+)"/m)?.[1];
  }
  for (const name of OWN_PACKAGES) {
    if (!found[`Cargo.lock:${name}`]) throw new Error(`Cargo.lock is missing ${name}.`);
  }
  if (Object.values(found).some((value) => value !== pkg)) {
    throw new Error(`Version files disagree:\n${JSON.stringify(found, null, 2)}`);
  }
  versionNumber(pkg);
  return pkg;
}

function readVersions(root, committed = false) {
  return Object.fromEntries(VERSION_FILES.map((file) => [file, committed
    ? git(root, ["show", `HEAD:${file}`]).stdout : readFileSync(join(root, file), "utf8")]));
}

/** Update and stage version files; the human reviews and creates the commit. */
export function prepareRelease(root, version) {
  const next = versionNumber(version);
  git(root, ["rev-parse", "--show-toplevel"]);
  const files = readVersions(root);
  const current = versions(files);
  const old = versionNumber(current);
  const firstDifference = next.findIndex((value, i) => value !== old[i]);
  if (firstDifference >= 0 && next[firstDifference] < old[firstDifference]) {
    throw new Error(`Refusing to downgrade ${current} to ${version}.`);
  }
  for (const file of ["package.json", "src-tauri/tauri.conf.json"]) {
    const value = JSON.parse(files[file]);
    value.version = version;
    files[file] = JSON.stringify(value, null, 2) + "\n";
  }
  files["Cargo.toml"] = files["Cargo.toml"].replace(
    /(^\[workspace\.package\][\s\S]*?^version\s*=\s*")[^"]+(".*$)/m, (_, before, after) => `${before}${version}${after}`,
  );
  files["Cargo.lock"] = files["Cargo.lock"].split(/(?=^\[\[package\]\]\r?$)/m).map((block) => {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    return OWN_PACKAGES.has(name) ? block.replace(/^version = "[^"]+"/m, `version = "${version}"`) : block;
  }).join("");
  versions(files); // Validate every edit before writing anything.
  for (const file of VERSION_FILES) writeFileSync(join(root, file), files[file]);
  git(root, ["add", "--", ...VERSION_FILES]);
  return `Prepared ${version}; staged version files only.\nReview all intended changes (including workflow changes) and commit them yourself in CLion.\nThen run: pnpm release:publish ${version}`;
}

/** Publish an already committed version. Never creates a commit or force-pushes. */
export function publishRelease(root, version) {
  versionNumber(version);
  const branchResult = git(root, ["symbolic-ref", "--quiet", "--short", "HEAD"], true);
  const branch = branchResult.stdout.trim();
  if (!branch) throw new Error("Check out a branch before publishing (HEAD is detached).");
  if (git(root, ["status", "--porcelain"]).stdout.trim()) {
    throw new Error("There are uncommitted changes. Review and commit them yourself before publishing.");
  }
  if (versions(readVersions(root, true)) !== version) {
    throw new Error(`HEAD does not contain version ${version}; prepare and commit that version first.`);
  }
  const head = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const tag = `v${version}`;
  const remote = git(root, ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], true);
  if (remote.status === 0) throw new Error(`${tag} already exists on origin. Existing release tags are never overwritten.`);
  if (remote.status !== 2) throw new Error(`Cannot check origin:\n${remote.stderr || remote.stdout}`);
  const local = git(root, ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`], true);
  if (local.status === 0) {
    if (git(root, ["rev-parse", `${tag}^{commit}`]).stdout.trim() !== head) {
      throw new Error(`Local ${tag} points to a different commit; it will not be moved.`);
    }
  } else if (local.status === 1) {
    git(root, ["tag", "-a", tag, head, "-m", `Diagramator ${tag}`]);
  } else throw new Error(`Cannot check local tag ${tag}: ${local.stderr}`);
  // Atomic publication: either both refs update, or neither does. No --force.
  git(root, ["push", "--atomic", "origin", `${head}:refs/heads/${branch}`, `refs/tags/${tag}:refs/tags/${tag}`]);
  return `Pushed ${branch} and ${tag}. GitHub Actions will build a draft release.\nWait for all builds and verify-release, then publish the draft on GitHub.`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const [command, version, ...extra] = process.argv.slice(2);
    if (extra.length || !["prepare", "publish"].includes(command)) {
      throw new Error("Usage: pnpm release:prepare <version> OR pnpm release:publish <version>");
    }
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    console.log(command === "prepare" ? prepareRelease(root, version) : publishRelease(root, version));
  } catch (error) {
    console.error(`Release stopped: ${error.message}`);
    process.exitCode = 1;
  }
}
