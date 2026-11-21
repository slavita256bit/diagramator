set positional-arguments

alias run := dev

# Start the desktop app with hot reload.
dev:
    pnpm tauri dev

# Prepare and stage the version files for a manual commit.
release *args:
    #!/usr/bin/env bash
    set -euo pipefail
    selection=""
    while (($#)); do
        case "$1" in
            --major|--minor|--patch)
                [[ -z "$selection" ]] || { echo "Choose one version option." >&2; exit 1; }
                selection="$1"
                shift
                ;;
            --version|-v)
                [[ -z "$selection" && $# -ge 2 ]] || { echo "Provide one version after --version." >&2; exit 1; }
                [[ "$2" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || { echo "Use a stable version such as 0.4.7." >&2; exit 1; }
                selection="$2"
                shift 2
                ;;
            --) shift ;;
            *) echo "Usage: just release [--major|--minor|--patch|--version X.Y.Z]" >&2; exit 1 ;;
        esac
    done
    selection="${selection:---patch}"
    if [[ -n "$(git status --porcelain -- package.json src-tauri/tauri.conf.json Cargo.toml Cargo.lock)" ]]; then
        echo "Release stopped: commit changes to the version files first." >&2
        exit 1
    fi
    version="$(node -e '
        const current = require("./package.json").version;
        if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(current)) throw new Error("Invalid current version");
        const parts = current.split(".").map(BigInt);
        const option = process.argv[1];
        const index = ["--major", "--minor", "--patch"].indexOf(option);
        if (index < 0) { console.log(option); } else {
            parts[index]++;
            for (let i = index + 1; i < parts.length; i++) parts[i] = 0n;
            console.log(parts.join("."));
        }
    ' -- "$selection")"
    pnpm release:prepare "$version"

# Push the manually committed version and its tag; CI creates a draft release.
publish:
    pnpm release:publish "$(node -p 'require("./package.json").version')"
