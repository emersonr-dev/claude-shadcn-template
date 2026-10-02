#!/usr/bin/env bash
# End-to-end smoke test: packs the CLI, installs the tarball into a throwaway
# React + shadcn/ui project, runs `init` twice, and exercises the Studio hook.
# Usage: test/smoke.sh   (run from the repo root; needs node, npm, jq)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
assert_file() { [ -f "$APP/$1" ] || fail "expected $1 to exist"; }

TARBALL="$(cd "$ROOT" && npm pack --silent --pack-destination "$WORK")"
APP="$WORK/app"
mkdir -p "$APP"
cat > "$APP/package.json" <<'JSON'
{ "name": "smoke-app", "private": true, "scripts": { "build": "vite build" },
  "dependencies": { "react": "19.0.0" }, "devDependencies": { "vite": "6.0.0" } }
JSON
echo '{ "rsc": false, "tailwind": { "css": "src/index.css" } }' > "$APP/components.json"
printf '# Smoke app\n\nExisting rules.\n' > "$APP/CLAUDE.md"

echo "--- installing $TARBALL"
(cd "$APP" && npm install --no-audit --no-fund --silent -D "$WORK/$TARBALL")

echo "--- init (first run)"
(cd "$APP" && npx --no-install claude-shadcn-cli init --yes --studio --no-ai)
for f in .claude/claude-shadcn.md .claude/settings.json .claude/commands/cui.md \
         .claude/hooks/check-shadcn-studio.sh .claude/skills/component/SKILL.md \
         .claude/.claude-shadcn-manifest.json .env.example .gitignore; do
  assert_file "$f"
done
[ -x "$APP/.claude/hooks/check-shadcn-studio.sh" ] || fail "hook is not executable"
grep -qx '@.claude/claude-shadcn.md' "$APP/CLAUDE.md" || fail "CLAUDE.md is missing the import line"
grep -q 'Existing rules.' "$APP/CLAUDE.md" || fail "CLAUDE.md lost the user's content"
jq -e '.registries["@ss-components"]' "$APP/components.json" >/dev/null || fail "registries not merged"
grep -q 'CUSTOMIZE' "$APP/.claude/claude-shadcn.md" && fail "managed file still has [CUSTOMIZE] markers"

echo "--- init (second run must be a no-op)"
(cd "$APP" && npx --no-install claude-shadcn-cli init --yes --studio --no-ai) | grep -q 'already up to date' \
  || fail "second run was not a no-op"

echo "--- hook decisions"
HOOK="$APP/.claude/hooks/check-shadcn-studio.sh"
STUDIO_CALL='{"tool_name":"mcp__shadcn-studio-mcp__install-theme","tool_input":{}}'
[ -z "$(echo '{"tool_name":"Bash","tool_input":{"command":"npx shadcn add button"}}' | CLAUDE_PROJECT_DIR="$APP" "$HOOK")" ] \
  || fail "hook should stay silent for plain shadcn installs"
[ -z "$(echo "$STUDIO_CALL" | CLAUDE_PROJECT_DIR="$APP" "$HOOK")" ] \
  || fail "hook should pass when registries are configured"
EMPTY="$WORK/empty" && mkdir -p "$EMPTY"
echo "$STUDIO_CALL" | CLAUDE_PROJECT_DIR="$EMPTY" "$HOOK" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null \
  || fail "hook should deny without components.json"

echo "--- incompatible project is rejected"
mkdir -p "$WORK/vue" && echo '{ "dependencies": { "vue": "3.0.0" } }' > "$WORK/vue/package.json"
if (cd "$WORK/vue" && node "$APP/node_modules/claude-shadcn-cli/bin/cli.js" init --yes --no-studio >/dev/null 2>&1); then
  fail "non-React project should exit non-zero"
fi

echo "smoke test passed"
