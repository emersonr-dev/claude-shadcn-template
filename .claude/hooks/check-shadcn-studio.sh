#!/usr/bin/env bash
# PreToolUse hook: gates any action that installs from Shadcn Studio's
# paid registries on this project genuinely having shadcn/ui + Shadcn
# Studio configured. Two entry points call this script (see settings.json):
#
#   1. The shadcn/studio MCP tools that actually install something
#      (collect_selected_*, get_add_command_for_*, install-theme) --
#      always gated, regardless of arguments, since calling them is
#      inherently a Studio action. Read-only fetch/metadata tools are not
#      matched, so browsing candidates always works per the fetch-then-gate
#      pattern documented in the component skill.
#   2. Bash calls starting with "npx shadcn" -- only gated if the command
#      actually references an "@ss-" registry item; a plain
#      `npx shadcn add button` is left alone entirely, since that never
#      touches Shadcn Studio and the check has nothing to say about it.
#
# This closes the gap where the MCP-only gate could be bypassed by running
# `npx shadcn add @ss-components/<name>` directly via Bash instead of
# through /cui, /rui, /iui.
#
# Deny: no components.json at all -- this isn't a shadcn/ui project yet.
# Ask: components.json exists but no @ss-components registry -- likely
#      missing the Studio credentials/registries merge, not a structural
#      problem, so this defers to the human rather than hard-blocking.
# Allow: registries present, or the call doesn't touch Studio at all.
#
# See claude-shadcn-template's README "Enforcement" section for why this
# exists alongside (not instead of) the prose prerequisite checks in
# cui.md/rui.md/iui.md/ftc.md.

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

if ! command -v jq >/dev/null 2>&1; then
  ask "jq is required for this project's shadcn-studio prerequisite check but was not found on PATH. Install jq, or confirm to proceed without the check."
fi

INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
  case "$COMMAND" in
    *@ss-*) : ;;  # references a Shadcn Studio registry item -- fall through to the check below
    *) allow ;;   # plain shadcn/ui install -- nothing Studio-specific, no check needed
  esac
fi

if [ ! -f "$FILE" ]; then
  deny "No components.json found at the project root. This project has not run npx shadcn@latest init yet, so there is nothing to install a Shadcn Studio item into. Run init first (see README Installation)."
fi

if jq -e '(.registries // {}) | has("@ss-components")' "$FILE" >/dev/null 2>&1; then
  allow
fi

ask "components.json exists but has no @ss-components Shadcn Studio registry configured yet. Merge components.registries.snippet.json into components.json first (see README Installation), or confirm to proceed if this call is expected to fail without it."
