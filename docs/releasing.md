# Releasing a new version

A retry of an existing GitHub Actions job does not require a new version. A changed
workflow must be committed and included in the commit used by the next release tag.

The release helper never creates a commit. Use it in two steps, with your own CLion
commit between them. For example, to release 0.4.7:

```sh
pnpm release:prepare 0.4.7
```

This updates and stages only `package.json`, `src-tauri/tauri.conf.json`,
`Cargo.toml` (workspace version), and the two workspace package entries in
`Cargo.lock`. Other dependency versions are preserved. It does not stage unrelated
changes, create a tag, push, or create a commit.

Run the relevant checks:

```sh
cargo check -p diagramator
pnpm build
pnpm test
node --test scripts/release.test.mjs scripts/sidecar-files.test.mjs
```

In CLion's Commit window, review the version changes and include every other change
intended for this release, especially `.github/workflows/release.yml`. Commit them
yourself. Once the working tree is clean:

```sh
pnpm release:publish 0.4.7
```

Publication verifies the versions in **committed HEAD**, creates the annotated tag
`v0.4.7`, and pushes the current branch and that tag to `origin` atomically. It never
force-pushes or overwrites a remote tag. A matching local tag from a failed push can
be retried; a local tag on another commit is rejected. Detached HEAD, uncommitted
changes (including untracked files), and mismatched versions stop publication.

Wait for the GitHub Actions `release` workflow, including `verify-release`, to pass.
The workflow creates a **draft** release; review its installers, then publish it on
GitHub. The helper does not publish the draft automatically.

No helper command has been run against the real repository merely by adding these
scripts. Tests make commits and push only inside temporary fixture repositories.
