#!/usr/bin/env bash
FAILURES=()

step() {
  local name="$1"; shift
  printf '\n▶ %s\n' "$name"
  if "$@"; then
    printf '✓ %s\n' "$name"
    return 0
  else
    printf '✗ %s FAILED\n' "$name"
    FAILURES+=("$name")
    return 1
  fi
}

# Independent installs
step ".NET 10 SDK"          bash -c 'sudo apt-get update -qq && sudo apt-get install -y dotnet-sdk-10.0'
step "dotnet-ef tool"       bash -c 'dotnet tool install --global dotnet-ef 2>/dev/null || dotnet tool update --global dotnet-ef'
step "jq"                   bash -c 'sudo apt-get install -y jq'
step "aws-cdk"              npm install -g aws-cdk
step "gh-copilot extension" bash -c 'gh extension install github/gh-copilot --force'

# uv → mcp-proxy-for-aws (dependent chain: mcp-proxy-for-aws requires uv)
if step "uv" bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'; then
  # Source uv env file if it exists, otherwise ensure uv is on PATH directly
  # shellcheck source=/dev/null
  [ -f "$HOME/.local/bin/env" ] && source "$HOME/.local/bin/env" || export PATH="$HOME/.local/bin:$PATH"
  step "mcp-proxy-for-aws" uv tool install mcp-proxy-for-aws
else
  FAILURES+=("mcp-proxy-for-aws (skipped: uv install failed)")
fi

# Verification (informational only — failures here don't indicate install failure)
printf '\n--- Installed versions ---\n'
aws     --version  2>&1 || true
cdk     --version  2>&1 || true
gh      --version  2>&1 || true
gh copilot --version </dev/null 2>&1 || true
uv      --version  2>&1 || true

# Summary
if (( ${#FAILURES[@]} > 0 )); then
  printf '\n⚠ WARNING: The following setup steps failed:\n'
  printf '  - %s\n' "${FAILURES[@]}"
  printf 'The devcontainer may be missing some tools. Check the log above for details.\n'
else
  printf '\n✓ All setup steps completed successfully.\n'
fi
