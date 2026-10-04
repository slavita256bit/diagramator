#!/usr/bin/env bash
# Installs the latest Diagramator release for this machine (Linux or macOS).
#
#   curl -fsSL https://raw.githubusercontent.com/slavita256bit/diagramator/master/install.sh | bash
#
set -euo pipefail

REPO="slavita256bit/diagramator"
API="https://api.github.com/repos/$REPO/releases/latest"

say() { printf '==> %s\n' "$1"; }
die() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

command -v curl >/dev/null 2>&1 || die "curl is required"

say "checking latest release"
release_json=$(curl -fsSL "$API") || die "couldn't reach the GitHub releases API"

# $1: a regex (grep -E) matched against the end of each asset's download URL.
asset_url() {
  printf '%s\n' "$release_json" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed -E 's/.*"(https:[^"]+)"/\1/' \
    | grep -E "$1" \
    | head -n1 || true
}

download() {
  say "downloading $(basename "$2")"
  curl -fsSL "$1" -o "$2" || die "download failed: $1"
}

os="$(uname -s)"
arch="$(uname -m)"

case "$os" in
Linux)
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  if command -v apt >/dev/null 2>&1; then
    pm=apt
  elif command -v dnf >/dev/null 2>&1; then
    pm=dnf
  elif command -v yum >/dev/null 2>&1; then
    pm=yum
  else
    pm=""
  fi

  if [ -n "$pm" ]; then
    if [ "$pm" = apt ]; then
      url=$(asset_url '_amd64\.deb$')
      pkg="$tmp/diagramator.deb"
    else
      url=$(asset_url '\.x86_64\.rpm$')
      pkg="$tmp/diagramator.rpm"
    fi
    [ -n "$url" ] || die "no installer for $pm found in the latest release"
    download "$url" "$pkg"
    say "installing with $pm (you may be asked for your password)"
    sudo "$pm" install -y "$pkg"
  else
    url=$(asset_url '_amd64\.AppImage$')
    [ -n "$url" ] || die "no AppImage found in the latest release"
    mkdir -p "$HOME/.local/bin"
    dest="$HOME/.local/bin/diagramator"
    download "$url" "$dest"
    chmod +x "$dest"
    say "installed AppImage to $dest"
    case ":$PATH:" in
    *":$HOME/.local/bin:"*) ;;
    *) say "add \$HOME/.local/bin to your PATH to run 'diagramator' from anywhere" ;;
    esac
  fi
  ;;

Darwin)
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  if [ "$arch" = arm64 ]; then
    url=$(asset_url '_aarch64\.dmg$')
  else
    url=$(asset_url '_x64\.dmg$')
  fi
  [ -n "$url" ] || die "no .dmg found in the latest release"

  dmg="$tmp/Diagramator.dmg"
  download "$url" "$dmg"
  mount_point="$tmp/mount"
  mkdir -p "$mount_point"
  hdiutil attach "$dmg" -mountpoint "$mount_point" -nobrowse -quiet || die "couldn't mount $dmg"
  app=$(find "$mount_point" -maxdepth 1 -name '*.app' | head -n1)
  if [ -z "$app" ]; then
    hdiutil detach "$mount_point" -quiet || true
    die "no .app bundle found inside the dmg"
  fi
  say "copying $(basename "$app") to /Applications (you may be asked for your password)"
  sudo cp -R "$app" /Applications/
  hdiutil detach "$mount_point" -quiet
  say "installed to /Applications/$(basename "$app")"
  ;;

*)
  die "unsupported OS: $os — download manually from https://github.com/$REPO/releases/latest"
  ;;
esac

say "done — Diagramator is installed"
