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

step "Copy MCP config" bash -c 'mkdir -p ~/.copilot && cp "/workspaces/ticket-platform/mcp-config.json" ~/.copilot/mcp-config.json'

step "Configure AWS credentials" bash -c '
  if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID"
    aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
    [ -n "$AWS_SESSION_TOKEN" ] && aws configure set aws_session_token "$AWS_SESSION_TOKEN" || true
    [ -n "$AWS_DEFAULT_REGION" ] && aws configure set region "$AWS_DEFAULT_REGION" || true
    [ -n "$AWS_REGION" ] && aws configure set region "$AWS_REGION" || true
  else
    echo "No AWS environment variables found, skipping credentials setup"
  fi
'

if (( ${#FAILURES[@]} > 0 )); then
  printf '\n⚠ WARNING: The following startup steps failed:\n'
  printf '  - %s\n' "${FAILURES[@]}"
  printf 'Check the log above for details.\n'
else
  printf '\n✓ All startup steps completed successfully.\n'
fi
