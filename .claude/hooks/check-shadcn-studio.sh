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
# Pass: registries present, or the call doesn't touch Studio at all --
#       exits with no output (no opinion), so normal permission handling
#       (allowlist, Auto Mode classifier, prompts) still applies. Never
#       emits "allow": that would skip the permission system entirely, and
#       the "npx shadcn*" prefilter only checks the command's prefix, so a
#       chained `npx shadcn add button && <anything>` would be waved through.
#
# Output is built with jq, never string concatenation: invalid hook JSON
# fails open (Claude Code ignores the hook and proceeds as if it weren't there).
#
# See claude-shadcn-template's README "Enforcement" section for why this
# exists alongside (not instead of) the prose prerequisite checks in
# cui.md/rui.md/iui.md/ftc.md.

set -euo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-.}"
FILE="$ROOT/components.json"

decide() {
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:$d,permissionDecisionReason:$r}}'
  exit 0
}

deny() { decide deny "$1"; }
ask() { decide ask "$1"; }
pass() { exit 0; }

if ! command -v jq >/dev/null 2>&1; then
  # Can't build output with jq here, so this one stays a fixed literal.
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"jq is required for this project'"'"'s shadcn-studio prerequisite check but was not found on PATH. Install jq, or confirm to proceed without the check."}}'
  exit 0
fi

INPUT="$(cat)"
TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

if [ "$TOOL_NAME" = "Bash" ]; then
  COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
  case "$COMMAND" in
    *@ss-*) : ;;  # references a Shadcn Studio registry item -- fall through to the check below
    *) pass ;;    # plain shadcn/ui install -- nothing Studio-specific, no check needed
  esac
fi

if [ ! -f "$FILE" ]; then
  deny "No components.json found at the project root. This project has not run npx shadcn@latest init yet, so there is nothing to install a Shadcn Studio item into. Run init first (see README Installation)."
fi

if jq -e '(.registries // {}) | has("@ss-components")' "$FILE" >/dev/null 2>&1; then
  pass
fi

ask "components.json exists but has no @ss-components Shadcn Studio registry configured yet. Merge components.registries.snippet.json into components.json first (see README Installation), or confirm to proceed if this call is expected to fail without it."
