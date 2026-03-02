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

step "Copy MCP config" bash -c 'mkdir -p ~/.copilot && cp "${CONTAINER_WORKSPACE_FOLDER}/mcp-config.json" ~/.copilot/mcp-config.json'

if (( ${#FAILURES[@]} > 0 )); then
  printf '\n⚠ WARNING: The following startup steps failed:\n'
  printf '  - %s\n' "${FAILURES[@]}"
  printf 'Check the log above for details.\n'
else
  printf '\n✓ All startup steps completed successfully.\n'
fi
