#!/usr/bin/env bash
# scripts/stage-site.sh — stage deployable site content into a target directory.
#
# Sole caller today: scripts/pages-build.sh (Cloudflare Pages git build, stages
# into ./dist). Script remains parameterized on target dir so it can be invoked
# directly for any one-off staging need without touching the build path.
#
# Why explicit allowlist (not rsync --exclude):
#   1. The Cloudflare Pages build image does NOT ship rsync (discovered the
#      hard way on fecledgerapp's first deploy — 2026-04-21). cp is universal.
#   2. Blacklist ("copy everything except...") fails open: any new tracked file
#      at repo root deploys by default. Allowlist fails closed: a new sensitive
#      file (CLAUDE.md, strategy docs, credentials) won't leak just because
#      someone forgot to update an exclusion list. Given this repo
#      intentionally co-locates internal docs with site assets, closed-by-
#      default is the right posture.
#
# Adding a new site asset: append to the explicit cp list below AND add it to
# critical_paths so future refactors don't silently drop it.
#
# Usage:
#   bash scripts/stage-site.sh <target_dir>
#
# Exits non-zero if any critical path is missing.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <target_dir>" >&2
  exit 2
fi

TARGET="$1"

# Move to repo root regardless of where this is invoked from
cd "$(dirname "$0")/.."

echo "Staging site content → $TARGET"
rm -rf "$TARGET" && mkdir -p "$TARGET"

# Root-level HTML pages (glob catches any new *.html at root)
cp ./*.html "$TARGET/"

# Shared client-side assets
cp main.js utils.js styles.css "$TARGET/"

# Redirect rules (Netlify-format; Cloudflare honors for paths not overridden
# by Pages Functions in functions/candidate/ and functions/committee/)
cp _redirects "$TARGET/"

# Pages Functions — Cloudflare auto-discovers this tree inside the build
# output directory and wires each file as a route. See functions/api/fec/
# and functions/api/aggregations/ for the API proxies; functions/candidate/
# and functions/committee/ for the clean-URL routers.
cp -R functions "$TARGET/"

# Sanity: critical paths must exist in the stage. A representative sample —
# not exhaustive — to catch both file-level and directory-level breakage.
critical_paths=(
  "index.html"
  "search.html"
  "candidate.html"
  "committee.html"
  "styles.css"
  "main.js"
  "utils.js"
  "_redirects"
  "functions/api/fec/[[path]].js"
  "functions/api/aggregations/[[path]].js"
  "functions/candidate/[[catchall]].js"
  "functions/committee/[[catchall]].js"
)
missing=0
for p in "${critical_paths[@]}"; do
  if [[ ! -e "$TARGET/$p" ]]; then
    echo "ERROR: staging is missing critical path: $p" >&2
    missing=1
  fi
done
if (( missing )); then
  echo "Aborting." >&2
  exit 1
fi

echo "Staged OK ($(du -sh "$TARGET" | awk '{print $1}')):"
ls "$TARGET"
