#!/usr/bin/env bash
# scripts/pages-build.sh — Cloudflare Pages build command (git-connected project).
#
# Wired as the build command on the fecledgerapp Pages project:
#   Settings → Build & deployments → Build command: bash scripts/pages-build.sh
#   Settings → Build & deployments → Build output directory: dist
#
# On every push to main (and on preview branches), Cloudflare checks out the
# repo, runs this script, and publishes the contents of dist/ to the Pages
# subdomain. Anything NOT in dist/ never reaches the internet.
#
# Delegates to scripts/stage-site.sh so the exclusion list stays in one place,
# shared with the manual deploy path in scripts/deploy-pages.sh.

set -euo pipefail

cd "$(dirname "$0")/.."

bash scripts/stage-site.sh dist
