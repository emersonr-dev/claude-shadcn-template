#!/usr/bin/env bash
# PreToolUse hook: gates the shadcn/studio MCP tool calls that actually
# install something (collect_selected_*, get_add_command_for_*,
# install-theme) on this project genuinely having shadcn/ui + Shadcn
# Studio configured. Read-only fetch/metadata tools are not matched by
# this hook, so browsing candidates always works per the fetch-then-gate
# pattern documented in the component skill.
#
# Deny: no components.json at all -- this isn't a shadcn/ui project yet.
# Ask: components.json exists but no @ss-components registry -- likely
#      missing the Studio credentials/registries merge, not a structural
#      problem, so this defers to the human rather than hard-blocking.
# Allow: registries present -- normal permission flow continues.
#
# See claude-shadcn-template's README "Design notes" for why this exists
# alongside (not instead of) the prose prerequisite checks in cui.md/
# rui.md/iui.md/ftc.md.

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-.}"
FILE="$ROOT/components.json"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

ask() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$1"
  exit 0
}

allow() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}\n'
  exit 0
}

if [ ! -f "$FILE" ]; then
  deny "No components.json found at the project root. This project has not run npx shadcn@latest init yet, so there is nothing for the shadcn/studio workflow commands to install into. Run init first (see README Installation)."
fi

if ! command -v jq >/dev/null 2>&1; then
  ask "jq is required for this project's shadcn-studio prerequisite check but was not found on PATH. Install jq, or confirm to proceed without the check."
fi

if jq -e '(.registries // {}) | has("@ss-components")' "$FILE" >/dev/null 2>&1; then
  allow
fi

ask "components.json exists but has no @ss-components Shadcn Studio registry configured yet. Merge components.registries.snippet.json into components.json first (see README Installation), or confirm to proceed if this call is expected to fail without it."
