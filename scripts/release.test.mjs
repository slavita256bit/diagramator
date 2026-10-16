import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareRelease, publishRelease } from "./release.mjs";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "diagramator-release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, "repo"), remote = join(root, "origin.git");
  mkdirSync(repo);
  const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--initial-branch=master");
  git("config", "user.name", "Release test");
  git("config", "user.email", "release-test@example.invalid");
  git("config", "core.hooksPath", join(root, "no-hooks"));
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  git("init", "--bare", remote);
  git("remote", "add", "origin", remote);
  mkdirSync(join(repo, "src-tauri"));
  writeFileSync(join(repo, "package.json"), '{"name":"diagramator","version":"0.4.6"}\n');
  writeFileSync(join(repo, "src-tauri/tauri.conf.json"), '{"version":"0.4.6","bundle":{"active":true}}\n');
  writeFileSync(join(repo, "Cargo.toml"), '[workspace]\nmembers = []\n\n[workspace.package]\nversion = "0.4.6"\nedition = "2021"\n\n[workspace.dependencies]\nsome-dependency = "1.0"\n');
  writeFileSync(join(repo, "Cargo.lock"), '# Generated\nversion = 4\n\n[[package]]\nname = "diagram-core"\nversion = "0.4.6"\n\n[[package]]\nname = "diagramator"\nversion = "0.4.6"\ndependencies = ["diagram-core"]\n\n[[package]]\nname = "external"\nversion = "0.4.6"\nsource = "registry+example"\n');
  git("add", "-A");
  git("commit", "-m", "Fixture baseline");
  return { repo, git, read: (file) => readFileSync(join(repo, file), "utf8") };
}

test("prepare updates and stages only version files without making a commit", (t) => {
  const { repo, git, read } = fixture(t);
  const before = git("rev-parse", "HEAD");
  writeFileSync(join(repo, "feature.txt"), "Unrelated work to review manually\n");
  prepareRelease(repo, "0.4.7");
  assert.equal(JSON.parse(read("package.json")).version, "0.4.7");
  assert.equal(JSON.parse(read("src-tauri/tauri.conf.json")).version, "0.4.7");
  assert.match(read("Cargo.toml"), /version = "0.4.7"/);
  assert.match(read("Cargo.lock"), /name = "diagram-core"\nversion = "0.4.7"/);
  assert.match(read("Cargo.lock"), /name = "diagramator"\nversion = "0.4.7"/);
  assert.match(read("Cargo.lock"), /name = "external"\nversion = "0.4.6"/);
  assert.equal(git("rev-parse", "HEAD"), before);
  assert.deepEqual(git("diff", "--cached", "--name-only").split("\n"), ["Cargo.lock", "Cargo.toml", "package.json", "src-tauri/tauri.conf.json"]);
  assert.equal(git("tag", "--list"), "");
  assert.match(git("status", "--short"), /\?\? feature.txt/);
  prepareRelease(repo, "0.4.7"); // Retry after a staging failure/manual interruption is safe.
});

test("prepare rejects invalid versions, downgrades, and inconsistent files before editing", (t) => {
  const { repo, read, git } = fixture(t);
  const original = read("Cargo.toml");
  for (const value of ["v0.4.7", "0.4.7;echo bad", "01.4.7", "0.4.7-rc.1", "0.4"]) {
    assert.throws(() => prepareRelease(repo, value), /stable version/);
  }
  assert.throws(() => prepareRelease(repo, "0.4.5"), /downgrade/);
  assert.equal(read("Cargo.toml"), original);
  assert.equal(git("status", "--porcelain"), "");
  writeFileSync(join(repo, "package.json"), '{"version":"0.4.8"}\n');
  assert.throws(() => prepareRelease(repo, "0.4.9"), /disagree/);
  assert.equal(read("Cargo.toml"), original);
});

test("publish requires a manual commit, then pushes branch and annotated tag to local origin", (t) => {
  const { repo, git } = fixture(t);
  assert.throws(() => publishRelease(repo, "0.4.7"), /HEAD does not contain/);
  prepareRelease(repo, "0.4.7");
  assert.throws(() => publishRelease(repo, "0.4.7"), /uncommitted/);
  assert.equal(git("tag", "--list"), "");
  git("commit", "-m", "Manual release commit in test fixture");
  const head = git("rev-parse", "HEAD"), count = git("rev-list", "--count", "HEAD");
  publishRelease(repo, "0.4.7");
  assert.equal(git("rev-list", "--count", "HEAD"), count, "publication never creates a commit");
  assert.equal(git("cat-file", "-t", "v0.4.7"), "tag");
  assert.ok(git("ls-remote", "origin", "refs/heads/master").startsWith(head));
  assert.ok(git("ls-remote", "origin", "refs/tags/v0.4.7^{}").startsWith(head));
  assert.throws(() => publishRelease(repo, "0.4.7"), /already exists on origin/);
});

test("publish can retry a matching local tag but never moves a conflicting tag", (t) => {
  const { repo, git } = fixture(t);
  prepareRelease(repo, "0.4.7");
  git("commit", "-m", "Manual version bump");
  git("tag", "-a", "v0.4.7", "-m", "Existing local tag from an interrupted publication");
  publishRelease(repo, "0.4.7");
  git("tag", "-a", "v0.4.8", "-m", "Intentionally misplaced fixture tag");
  const oldTarget = git("rev-parse", "v0.4.8^{commit}");
  prepareRelease(repo, "0.4.8");
  git("commit", "-m", "Next manual version bump");
  assert.throws(() => publishRelease(repo, "0.4.8"), /different commit/);
  assert.equal(git("rev-parse", "v0.4.8^{commit}"), oldTarget);
});
