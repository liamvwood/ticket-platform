#!/usr/bin/env bash
# dev.sh — start the full Ticket Platform stack for local development and E2E testing.
#
# Usage:
#   ./scripts/dev.sh           # start stack (API + frontend)
#   ./scripts/dev.sh --test    # start stack, then run E2E tests
#   ./scripts/dev.sh --stop    # kill background API + frontend processes
#
# The script prefers Docker Compose when the Docker daemon is available.
# If Docker is not running (e.g. devcontainer without DinD), it falls back
# to a native PostgreSQL cluster (pg_ctlcluster 16 main).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$REPO_ROOT/src/TicketPlatform.Api"
WEB_DIR="$REPO_ROOT/src/TicketPlatform.Web"
INF_DIR="$REPO_ROOT/src/TicketPlatform.Infrastructure"

API_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:5173"
DB_CONN="Host=localhost;Port=5432;Database=ticketplatform;Username=postgres;Password=postgres"
DB_URL="postgresql://postgres:postgres@localhost:5432/ticketplatform"

USE_DOCKER=false
RUN_TESTS=false
STOP=false

# ── Argument parsing ────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --test)  RUN_TESTS=true ;;
    --stop)  STOP=true ;;
    --help|-h)
      echo "Usage: $0 [--test] [--stop]"
      echo "  --test  Run E2E tests after the stack is ready"
      echo "  --stop  Kill background API + frontend processes started by this script"
      exit 0
      ;;
  esac
done

# ── Colours ─────────────────────────────────────────────────────────────────
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
step()   { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

# ── --stop ───────────────────────────────────────────────────────────────────
if $STOP; then
  step "Stopping background processes"
  if $USE_DOCKER || docker info &>/dev/null 2>&1; then
    cd "$REPO_ROOT" && docker compose down && green "Docker Compose stopped"
  fi
  pkill -f "TicketPlatform.Api.dll" 2>/dev/null && green "API stopped" || yellow "API not running"
  pkill -f "vite"                   2>/dev/null && green "Frontend stopped" || yellow "Frontend not running"
  exit 0
fi

# ── Prerequisite checks ──────────────────────────────────────────────────────
step "Checking prerequisites"

if ! command -v dotnet &>/dev/null; then
  red "dotnet SDK not found. Install: sudo apt-get install -y dotnet-sdk-10.0"
  exit 1
fi
green "dotnet $(dotnet --version)"

if ! command -v node &>/dev/null; then
  red "Node.js not found. Install via nvm or apt."
  exit 1
fi
green "node $(node --version)"

# ── Docker vs native Postgres ────────────────────────────────────────────────
step "Checking Docker"
if docker info &>/dev/null 2>&1; then
  green "Docker daemon is running — using Docker Compose"
  USE_DOCKER=true
else
  yellow "Docker daemon not available — falling back to native PostgreSQL"
  USE_DOCKER=false
fi

# ── Start database ───────────────────────────────────────────────────────────
step "Starting database"
if $USE_DOCKER; then
  cd "$REPO_ROOT"
  docker compose up -d db
  echo "Waiting for Postgres health check..."
  for i in $(seq 1 20); do
    docker compose exec db pg_isready -U postgres &>/dev/null && green "Postgres ready" && break
    echo "  waiting ($i/20)..."
    sleep 2
  done
else
  # Native postgres — try pg_ctlcluster, fall back to pg_ctl
  if command -v pg_ctlcluster &>/dev/null; then
    sudo pg_ctlcluster 16 main start 2>&1 | grep -v "^$" || true
  elif command -v pg_ctl &>/dev/null; then
    pg_ctl start -D /var/lib/postgresql/16/main -l /tmp/pg.log 2>&1 || true
  else
    red "No PostgreSQL found. Install: sudo apt-get install -y postgresql"
    exit 1
  fi

  # Create DB if needed
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ticketplatform'" \
    | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE ticketplatform;" 2>&1
  green "Native PostgreSQL ready on :5432"
fi

# ── EF Core migrations ───────────────────────────────────────────────────────
step "Applying database migrations"
cd "$API_DIR"
export ConnectionStrings__DefaultConnection="$DB_CONN"
dotnet ef database update --project "$INF_DIR" --no-build 2>&1 \
  || dotnet ef database update --project "$INF_DIR"
green "Migrations applied"

# ── Seed test venue ──────────────────────────────────────────────────────────
step "Seeding test venue"
PGPASSWORD=postgres psql -h localhost -U postgres -d ticketplatform -c "
  INSERT INTO \"Venues\" (\"Id\",\"Name\",\"Address\",\"City\",\"State\",\"CreatedAt\")
  VALUES ('a0000000-0000-0000-0000-000000000001',
          'Stubb''s Waller Creek','801 Red River St','Austin','TX',now())
  ON CONFLICT DO NOTHING;" 2>&1
green "Test venue seeded"

# ── Build API ────────────────────────────────────────────────────────────────
step "Building API"
cd "$REPO_ROOT"
dotnet build src/TicketPlatform.Api/TicketPlatform.Api.csproj -c Release -o /tmp/ticket-api-build 2>&1 \
  | tail -5
green "API built"

# ── Start API ────────────────────────────────────────────────────────────────
step "Starting API"
# Kill any existing instance
pkill -f "TicketPlatform.Api.dll" 2>/dev/null || true
sleep 1

export ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_URLS="$API_URL"
export ConnectionStrings__DefaultConnection="$DB_CONN"
export Payment__Provider=Mock
export Otp__Provider=Mock
export Jwt__Secret="local-dev-secret-at-least-32-characters-long"

nohup bash -c 'cd /tmp/ticket-api-build && dotnet TicketPlatform.Api.dll' > /tmp/api.log 2>&1 &
API_PID=$!
echo "API PID: $API_PID"

step "Waiting for API"
for i in $(seq 1 45); do
  if curl -sf "$API_URL/healthz" &>/dev/null; then
    green "API ready at $API_URL"
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    red "API process died. Log:"
    tail -40 /tmp/api.log
    exit 1
  fi
  echo "  waiting ($i/45)..."
  sleep 2
done

# ── Seed E2E users ───────────────────────────────────────────────────────────
step "Seeding E2E users"

# Buyer
STATUS=$(curl -s -w "%{http_code}" -o /tmp/reg.json \
  -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"e2ebuyer@slingshot.dev","password":"Password123!","phoneNumber":""}')
[ "$STATUS" = "200" ] || [ "$STATUS" = "409" ] \
  || { red "Buyer registration failed ($STATUS): $(cat /tmp/reg.json)"; exit 1; }
green "Buyer user: $STATUS"

# VenueAdmin via invite flow
OWNER_TOKEN=$(curl -sf -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@slingshot.dev","password":"ChangeMe123!"}' | jq -r '.token')
[ -n "$OWNER_TOKEN" ] || { red "AppOwner login failed — check appsettings.Development.json seed"; exit 1; }

INVITE=$(curl -sf -X POST "$API_URL/admin/invites" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"email":"venue@slingshot.dev","venueName":"Test Venue Admin"}')
INVITE_TOKEN=$(echo "$INVITE" | jq -r '.token // empty')

if [ -n "$INVITE_TOKEN" ]; then
  curl -sf -X POST "$API_URL/invites/$INVITE_TOKEN/accept" \
    -H "Content-Type: application/json" \
    -d '{"password":"Password123!","phoneNumber":""}' > /dev/null
  green "VenueAdmin seeded via invite"
else
  V_STATUS=$(curl -s -w "%{http_code}" -o /tmp/vlogin.json \
    -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"venue@slingshot.dev","password":"Password123!"}')
  [ "$V_STATUS" = "200" ] \
    || { red "VenueAdmin seed failed ($V_STATUS): $(cat /tmp/vlogin.json)"; exit 1; }
  green "VenueAdmin already exists"
fi

# ── Install frontend deps ────────────────────────────────────────────────────
step "Installing frontend dependencies"
cd "$WEB_DIR"
npm install --prefer-offline 2>&1 | tail -3

# ── Start frontend ───────────────────────────────────────────────────────────
step "Starting frontend dev server"
pkill -f "vite" 2>/dev/null || true
sleep 1

VITE_API_URL="$API_URL" nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

step "Waiting for frontend"
for i in $(seq 1 20); do
  if curl -sf "$FRONTEND_URL" &>/dev/null; then
    green "Frontend ready at $FRONTEND_URL"
    break
  fi
  echo "  waiting ($i/20)..."
  sleep 2
done

# ── Health check summary ─────────────────────────────────────────────────────
printf '\n'
green "════════════════════════════════════════"
green "  Stack is up!"
green "════════════════════════════════════════"
echo ""
echo "  Frontend : $FRONTEND_URL"
echo "  API      : $API_URL"
echo "  Health   : $API_URL/healthz"
echo ""
echo "  API logs : tail -f /tmp/api.log"
echo "  Web logs : tail -f /tmp/frontend.log"
echo ""
echo "  Stop     : ./scripts/dev.sh --stop"
echo ""

# ── Optional: run E2E tests ──────────────────────────────────────────────────
if $RUN_TESTS; then
  step "Running E2E tests"
  cd "$WEB_DIR"
  npx playwright install chromium --with-deps 2>&1 | tail -3
  E2E_BASE_URL="$FRONTEND_URL" E2E_API_URL="$API_URL" npx playwright test
  green "E2E tests complete — report: $WEB_DIR/e2e-report/index.html"
fi
