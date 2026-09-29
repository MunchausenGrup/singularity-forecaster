#!/usr/bin/env bash
# deploy.sh — two-stage deploy: GitHub → Cloudflare Pages
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

load_env() {
  if [ ! -f .env ]; then
    echo -e "${RED}.env not found${NC}"
    echo "Copy .env.example → .env and fill in CF_API_TOKEN, CF_ACCOUNT_ID"
    exit 1
  fi
  export $(grep -v '^#' .env | xargs)
}

# ── Stage 1: GitHub ──────────────────────────────────────────────
deploy_github() {
  echo -e "${YELLOW}=== Stage 1: Push to GitHub ===${NC}"

  if [ -z "${GITHUB_REPO:-}" ]; then
    echo -e "${RED}GITHUB_REPO not set in .env${NC}"
    echo "Example: GITHUB_REPO=username/singularity-forecaster"
    exit 1
  fi

  # Check if remote exists
  if git remote get-url origin &>/dev/null; then
    echo "Updating origin → https://github.com/${GITHUB_REPO}.git"
    git remote set-url origin "https://github.com/${GITHUB_REPO}.git"
  else
    echo "Adding origin → https://github.com/${GITHUB_REPO}.git"
    git remote add origin "https://github.com/${GITHUB_REPO}.git"
  fi

  # Create GitHub repo if needed (requires gh CLI)
  if command -v gh &>/dev/null && [ -z "$(gh repo view ${GITHUB_REPO} 2>/dev/null || true)" ]; then
    echo "Creating GitHub repo: ${GITHUB_REPO}"
    gh repo create "${GITHUB_REPO}" --public --clone=false --confirm 2>/dev/null || true
  fi

  git add -A
  git commit -m "ci: deploy singularity-forecaster $(date +%Y-%m-%d_%H:%M)" || echo "Nothing to commit"
  git push -u origin ${GITHUB_BRANCH:-main} --force

  echo -e "${GREEN}✓ GitHub push complete${NC}"
}

# ── Stage 2: Cloudflare Pages ───────────────────────────────────
deploy_cloudflare() {
  echo -e "${YELLOW}=== Stage 2: Deploy to Cloudflare Pages ===${NC}"

  if [ -z "${CF_API_TOKEN:-}" ]; then
    echo -e "${RED}CF_API_TOKEN not set in .env${NC}"
    echo "Get token: https://dash.cloudflare.com/profile/api-tokens"
    echo "Permissions needed: Cloudflare Pages → Edit"
    exit 1
  fi

  if ! command -v npx &>/dev/null; then
    echo -e "${RED}npx not found. Install Node.js first.${NC}"
    exit 1
  fi

echo "Installing wrangler..."
  npm install --silent 2>/dev/null

  echo "Deploying to Cloudflare Pages..."
  npx wrangler pages deploy --project-name "${CF_PROJECT_NAME:-singularity-forecaster}" .

  echo -e "${GREEN}✓ Cloudflare Pages deploy complete${NC}"
  echo ""
  echo "Live URL: https://${CF_PROJECT_NAME:-singularity-forecaster}.<your-account>.workers.dev"
  echo "(Custom domain can be configured in Cloudflare dashboard)"
}

# ── Main ──────────────────────────────────────────────────────────
case "${1:-both}" in
  github)
    load_env
    deploy_github
    ;;
  cloudflare)
    load_env
    deploy_cloudflare
    ;;
  both|"")
    load_env
    deploy_github
    echo ""
    deploy_cloudflare
    ;;
  *)
    echo "Usage: $0 {github|cloudflare|both}"
    exit 1
    ;;
esac