#!/bin/bash
# Builds ONE werun.Blocks.Community block (or the shared modules / presets) without
# touching the others, so several people can work in parallel.
# Usage: bin/build-block.sh <slug> [<slug> …]   e.g. bin/build-block.sh cta
#   <slug>  : src/<slug> → build/<slug>/
#   shared  : src/shared/view/*.js → build/shared/ (the wrbc-<module> handles)
#   presets : src/presets (+ shared editor hooks) → build/presets/
# `npm run build` builds everything once at the end.
set -euo pipefail
PLUGIN="$( cd "$( dirname "$0" )/.." && pwd )"
TMP="$( mktemp -d )"
trap 'rm -rf "$TMP"' EXIT
cd "$PLUGIN"
for SLUG in "$@"; do
  OUT="$TMP/$SLUG"
  if [ "$SLUG" = "shared" ] || [ "$SLUG" = "presets" ]; then
    # The project config builds every block plus presets and shared: point it
    # at an empty source folder so only the extra entries are built.
    mkdir -p "$TMP/empty-src"
    npx wp-scripts build --webpack-src-dir="$TMP/empty-src" --output-path="$OUT" >"$OUT.log" 2>&1 || { cat "$OUT.log"; exit 1; }
    mkdir -p "build/$SLUG"
    rsync -a "$OUT/$SLUG/" "build/$SLUG/"
  else
    [ -f "src/$SLUG/block.json" ] || { echo "No src/$SLUG/block.json"; exit 1; }
    npx wp-scripts build --webpack-src-dir="src/$SLUG" --output-path="$OUT" --webpack-copy-php >"$OUT.log" 2>&1 || { cat "$OUT.log"; exit 1; }
    mkdir -p "build/$SLUG"
    rsync -a --delete --exclude 'presets/' --exclude 'shared/' "$OUT/" "build/$SLUG/"
  fi
  echo "built $SLUG -> build/$SLUG"
done
