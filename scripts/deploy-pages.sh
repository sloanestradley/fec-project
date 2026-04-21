#!/usr/bin/env bash
# scripts/deploy-pages.sh — manual deploy to the fecledger Cloudflare Pages project.
#
# TEMPORARY workaround until the Pages project is migrated to git-connected.
# See project-brief.md → Infrastructure / Architecture debt → "Pages project
# is Direct Upload" for the migration scope, root-cause, and the full list of
# steps that will retire this script.
#
# What this script does:
#   1. Delegates staging to scripts/stage-site.sh (shared with the git-connected
#      build path in scripts/pages-build.sh) — one exclusion list, two callers.
#      HTML, CSS, JS, functions/, _redirects are included. Everything else —
#      internal docs, pipeline source, tests, the DuckDB binary in
#      scripts/node_modules — is explicitly excluded.
#   2. Uploads the staging dir via `wrangler pages deploy`. Uses `@latest` to
#      avoid the transient 4.82 "Unknown internal error" bug fixed in 4.83.
#
# DO NOT run `npx wrangler pages deploy .` at repo root. That would upload the
# entire working tree — CLAUDE.md, claude-to-claude.md, project-brief.md, the
# DuckDB binary (~30 MB), pipeline source, Playwright fixtures — all reachable
# via guessable URLs on fecledger.pages.dev. The exclusion list in
# stage-site.sh is what keeps that from happening.
#
# Usage:
#   bash scripts/deploy-pages.sh

set -euo pipefail

# Move to repo root regardless of where this is invoked from
cd "$(dirname "$0")/.."

STAGE=/tmp/fec-deploy
bash scripts/stage-site.sh "$STAGE"

# Deploy. @latest avoids the wrangler 4.82 "Unknown internal error" Functions-
# publish bug fixed in 4.83 (encountered 2026-04-17). Pin only if perf becomes
# a concern — fresh npx download adds ~10-30s per run.
npx wrangler@latest pages deploy "$STAGE" \
  --project-name=fecledger \
  --branch=main \
  --commit-dirty=true
