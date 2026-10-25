#!/bin/bash
# Removes the a11y fixtures (posts, pages, attachments, terms, files, caches).
#   cleanup.sh          fixtures only (the mu-plugin stays)
#   cleanup.sh --all    also removes wp-content/mu-plugins/wrbc-a11y-fixtures.php
#   cleanup.sh --dry    only counts
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WP_ROOT="${WRB_WP_ROOT:?Set WRB_WP_ROOT to the WordPress root of the local test site}"
ARGS=()
for a in "$@"; do ARGS+=("${a#--}"); done
cd "$WP_ROOT" && wp eval-file "$HERE/cleanup.php" "${ARGS[@]+"${ARGS[@]}"}"
