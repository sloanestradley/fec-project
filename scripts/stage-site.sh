#!/usr/bin/env bash
# scripts/stage-site.sh — stage deployable site content into a target directory.
#
# One exclusion list, two callers:
#   - scripts/pages-build.sh        → stages into ./dist (Cloudflare Pages git build)
#   - scripts/deploy-pages.sh       → stages into /tmp/fec-deploy (manual wrangler deploy)
#
# Keeping both paths in one script prevents drift between the CI contract and
# the manual fallback. If you change what's excluded (or what's required),
# change it here — both callers pick it up.
#
# What this script does:
#   1. rsyncs site content into the target dir, excluding internal docs,
#      pipeline source, tests, package manifests, and anything else that
#      should not be publicly reachable on the Pages subdomain.
#   2. Sanity-checks that critical paths are present after staging. Catches
#      bad rsync patterns or future rearrangements that silently drop
#      required files.
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

rsync -a \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.claude' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='.wrangler' \
  --exclude='.DS_Store' \
  --exclude='.gitignore' \
  --exclude='.env*' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='scripts' \
  --exclude='pipeline' \
  --exclude='tests' \
  --exclude='test-results' \
  --exclude='playwright-report' \
  --exclude='strategy' \
  --exclude='plans' \
  --exclude='*.md' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='playwright.config.js' \
  --exclude='playwright.smoke.config.js' \
  ./ "$TARGET/"

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
