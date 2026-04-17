#!/usr/bin/env bash
# scripts/deploy-pages.sh — manual deploy to the fecledger Cloudflare Pages project.
#
# TEMPORARY workaround until the Pages project is migrated to git-connected.
# See project-brief.md → Infrastructure / Architecture debt → "Pages project
# is Direct Upload" for the migration scope, root-cause, and the full list of
# steps that will retire this script.
#
# What this script does:
#   1. Stages only deployable site content into /tmp/fec-deploy via rsync
#      (HTML, CSS, JS, functions/, _redirects). Everything else — internal
#      docs, pipeline source, tests, the DuckDB binary in scripts/node_modules
#      — is explicitly excluded.
#   2. Sanity-checks that critical paths are present in the staging dir
#      (catches bad rsync patterns or future rearrangements that silently drop
#      required files).
#   3. Uploads the staging dir via `wrangler pages deploy`. Uses `@latest` to
#      avoid the transient 4.82 "Unknown internal error" bug fixed in 4.83.
#
# DO NOT run `npx wrangler pages deploy .` at repo root. That would upload the
# entire working tree — CLAUDE.md, claude-to-claude.md, project-brief.md, the
# DuckDB binary (~30 MB), pipeline source, Playwright fixtures — all reachable
# via guessable URLs on fecledger.pages.dev. The exclusion list below is what
# keeps that from happening.
#
# Usage:
#   bash scripts/deploy-pages.sh

set -euo pipefail

# Move to repo root regardless of where this is invoked from
cd "$(dirname "$0")/.."

STAGE=/tmp/fec-deploy
echo "Staging site content → $STAGE"
rm -rf "$STAGE" && mkdir -p "$STAGE"

rsync -a \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.claude' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.gitignore' \
  --exclude='.env*' \
  --exclude='node_modules' \
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
  ./ "$STAGE/"

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
  "functions/candidate/[[catchall]].js"
  "functions/committee/[[catchall]].js"
)
missing=0
for p in "${critical_paths[@]}"; do
  if [[ ! -e "$STAGE/$p" ]]; then
    echo "ERROR: staging is missing critical path: $p" >&2
    missing=1
  fi
done
if (( missing )); then
  echo "Aborting deploy." >&2
  exit 1
fi

echo "Staged OK ($(du -sh "$STAGE" | awk '{print $1}')):"
ls "$STAGE"
echo

# Deploy. @latest avoids the wrangler 4.82 "Unknown internal error" Functions-
# publish bug fixed in 4.83 (encountered 2026-04-17). Pin only if perf becomes
# a concern — fresh npx download adds ~10-30s per run.
npx wrangler@latest pages deploy "$STAGE" \
  --project-name=fecledger \
  --branch=main \
  --commit-dirty=true
