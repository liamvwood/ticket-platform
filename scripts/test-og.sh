#!/usr/bin/env bash
# Test OG meta tags locally
# Usage: ./scripts/test-og.sh [base_url]
# Default base_url: http://localhost:5000

set -euo pipefail

BASE="${1:-http://localhost:5000}"
echo "=== Testing OG tags at $BASE ==="

# Get first event from API
EVENT_ID=$(curl -sf "$BASE/api/events?pageSize=1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['items'][0]['id'] if d.get('items') else d[0]['id'])" 2>/dev/null || echo "")

if [ -z "$EVENT_ID" ]; then
  echo "❌ Could not fetch any events from $BASE/api/events"
  exit 1
fi

echo "Using event ID: $EVENT_ID"
OG_URL="$BASE/og/events/$EVENT_ID"
echo "OG URL: $OG_URL"

# Fetch OG HTML
HTML=$(curl -sfL "$OG_URL" -H "Accept: text/html")

echo ""
echo "=== Checking OG meta tags ==="

check_tag() {
  local label="$1"
  local pattern="$2"
  if echo "$HTML" | grep -qi "$pattern"; then
    echo "✅ $label"
  else
    echo "❌ $label MISSING"
    FAIL=1
  fi
}

FAIL=0
check_tag "og:title" 'property="og:title"'
check_tag "og:description" 'property="og:description"'
check_tag "og:image" 'property="og:image"'
check_tag "og:image:width" 'property="og:image:width"'
check_tag "og:image:height" 'property="og:image:height"'
check_tag "og:url" 'property="og:url"'
check_tag "twitter:card" 'name="twitter:card"'
check_tag "twitter:image" 'name="twitter:image"'

# Extract image URL
IMG_URL=$(echo "$HTML" | grep -oP '(?<=og:image" content=")[^"]+' | head -1)
if [ -z "$IMG_URL" ]; then
  IMG_URL=$(echo "$HTML" | grep -oP "(?<=og:image\" content=')[^']+" | head -1)
fi
echo ""
echo "og:image URL: $IMG_URL"

if [ -n "$IMG_URL" ]; then
  # Fetch image and check content-type
  IMG_CT=$(curl -sfI "$IMG_URL" | grep -i "content-type" | head -1 | tr -d '\r')
  echo "Image Content-Type: $IMG_CT"

  if echo "$IMG_CT" | grep -qi "image/png\|image/jpeg\|image/jpg\|image/webp"; then
    echo "✅ Image is PNG/JPEG (iMessage compatible)"
  elif echo "$IMG_CT" | grep -qi "image/svg"; then
    echo "❌ Image is SVG — iMessage will NOT show this preview"
    FAIL=1
  else
    echo "⚠️  Unknown image type: $IMG_CT"
  fi

  # Check absolute URL
  if echo "$IMG_URL" | grep -q "^https\?://"; then
    echo "✅ Image URL is absolute"
  else
    echo "❌ Image URL is relative — iMessage requires absolute URLs"
    FAIL=1
  fi
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "✅ All OG checks passed — should work in iMessage"
else
  echo "❌ Some OG checks failed — see above"
  exit 1
fi
