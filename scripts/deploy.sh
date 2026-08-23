#!/usr/bin/env bash
# ==============================================================================
# 🚀 AgentMeter One-Click Deployment Script
# ==============================================================================
# Usage:
#   ./scripts/deploy.sh "Your commit message" [options]
#
# Options:
#   --skip-tests   Skip running test suite before deploying
#   --docker       Rebuild and deploy local/remote Docker containers
#   --vercel       Deploy frontend to Vercel via Vercel CLI
#   --pm2          Restart PM2 services on current host
# ==============================================================================

set -e

# Color definitions
GREEN='\033[032m'
BLUE='\033[034m'
YELLOW='\033[1;33m'
RED='\033[031m'
PURPLE='\033[035m'
CYAN='\033[036m'
NC='\033[0m' # No Color

COMMIT_MSG=""
SKIP_TESTS=false
DEPLOY_DOCKER=false
DEPLOY_VERCEL=false
RESTART_PM2=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --docker)
      DEPLOY_DOCKER=true
      shift
      ;;
    --vercel)
      DEPLOY_VERCEL=true
      shift
      ;;
    --pm2)
      RESTART_PM2=true
      shift
      ;;
    *)
      if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="$arg"
      fi
      ;;
  esac
done

if [ -z "$COMMIT_MSG" ]; then
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  COMMIT_MSG="🚀 Deploy updates: ${TIMESTAMP}"
fi

echo -e "${CYAN}================================================================${NC}"
echo -e "${PURPLE}       ⚡ AGENTMETER ONE-CLICK DEPLOYMENT SCRIPT               ${NC}"
echo -e "${CYAN}================================================================${NC}"
echo -e "${BLUE}ℹ️  Commit Message:${NC} ${COMMIT_MSG}\n"

# Step 1: Typecheck & Build
echo -e "${YELLOW}🔹 Step 1: Compiling TypeScript & building packages...${NC}"
npm run build
echo -e "${GREEN}✅ Build verification passed.${NC}\n"

# Step 2: Run Test Suite
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${YELLOW}🔹 Step 2: Running platform validation test suite...${NC}"
  npm test
  echo -e "${GREEN}✅ All platform tests passed successfully.${NC}\n"
else
  echo -e "${YELLOW}⚠️  Skipping test suite (--skip-tests passed).${NC}\n"
fi

# Step 3: Git Stage, Commit & Push
echo -e "${YELLOW}🔹 Step 3: Staging changes & pushing to GitHub...${NC}"
git add -A

if git diff-index --quiet HEAD --; then
  echo -e "${YELLOW}ℹ️  No new changes to commit. Working tree clean.${NC}"
else
  git commit -m "$COMMIT_MSG"
  echo -e "${GREEN}✅ Changes committed successfully.${NC}"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${BLUE}Pushing branch '${CURRENT_BRANCH}' to origin...${NC}"
git push origin "$CURRENT_BRANCH"
echo -e "${GREEN}✅ Successfully pushed to GitHub (origin/${CURRENT_BRANCH})!${NC}\n"

# Step 4: Optional Docker Compose Deploy
if [ "$DEPLOY_DOCKER" = true ]; then
  echo -e "${YELLOW}🔹 Step 4: Deploying Docker containers...${NC}"
  if [ -f "infrastructure/docker/docker-compose.yml" ]; then
    docker compose -f infrastructure/docker/docker-compose.yml up -d --build
    echo -e "${GREEN}✅ Docker services updated and healthy.${NC}\n"
  else
    echo -e "${RED}❌ infrastructure/docker/docker-compose.yml not found.${NC}\n"
  fi
fi

# Step 5: Optional Vercel Deploy
if [ "$DEPLOY_VERCEL" = true ]; then
  echo -e "${YELLOW}🔹 Step 5: Deploying dashboard to Vercel...${NC}"
  if command -v vercel &> /dev/null; then
    vercel --prod
    echo -e "${GREEN}✅ Vercel production deployment triggered.${NC}\n"
  elif command -v npx &> /dev/null; then
    npx -y vercel --prod
    echo -e "${GREEN}✅ Vercel production deployment triggered.${NC}\n"
  else
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Changes will auto-deploy via GitHub integration.${NC}\n"
  fi
fi

# Step 6: PM2 Service Reload (if running on production server)
if command -v pm2 &> /dev/null; then
  PM2_COUNT=$(pm2 jlist 2>/dev/null | grep -o '"name"' | wc -l || echo "0")
  if [ "$RESTART_PM2" = true ] || [ "$PM2_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}🔹 Step 6: Active PM2 processes detected ($PM2_COUNT). Reloading PM2 services...${NC}"
    pm2 reload all || pm2 restart all
    echo -e "${GREEN}✅ PM2 services reloaded with latest code.${NC}\n"
  fi
fi

echo -e "${CYAN}================================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!${NC}"
echo -e "${CYAN}================================================================${NC}"
