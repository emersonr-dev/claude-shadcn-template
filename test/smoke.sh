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
# A blanket `.env*`, the way create-next-app ships it.
printf 'node_modules\n.env*\n' > "$APP/.gitignore"

echo "--- installing $TARBALL"
(cd "$APP" && npm install --no-audit --no-fund --silent -D "$WORK/$TARBALL")

echo "--- init (first run)"
(cd "$APP" && npx --no-install claude-shadcn-cli init --yes --studio --figma --no-ai)
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
assert_file .claude/commands/ftc.md
jq -e '.mcpServers.figma.url == "https://mcp.figma.com/mcp"' "$APP/.mcp.json" >/dev/null || fail ".mcp.json is missing the Figma server"
jq -e '.permissions.allow | index("mcp__figma__get_design_context")' "$APP/.claude/settings.json" >/dev/null || fail "Figma read tools not allowed"
jq -e '.permissions.allow | index("mcp__shadcn-studio-mcp__*") | not' "$APP/.claude/settings.json" >/dev/null \
  || fail "Studio MCP tools must not be wildcard-allowed"
jq -e '.permissions.allow | index("Bash(npx shadcn@latest add:*)") | not' "$APP/.claude/settings.json" >/dev/null \
  || fail "open-ended shadcn add must not be pre-approved"

# Ask git itself, since the whole point is whether the file can be committed.
(cd "$APP" && git init -q . && git check-ignore -q .env.example) \
  && fail ".env.example is gitignored, so the placeholders never reach the repo"

echo "--- init (second run must be a no-op)"
(cd "$APP" && npx --no-install claude-shadcn-cli init --yes --studio --figma --no-ai) | grep -q 'already up to date' \
  || fail "second run was not a no-op"

echo "--- Figma without a Studio license"
FIG="$WORK/figma-only" && mkdir -p "$FIG"
cp "$APP/package.json" "$FIG/" && echo '{ "rsc": false, "tailwind": { "css": "src/index.css" } }' > "$FIG/components.json"
(cd "$FIG" && node "$APP/node_modules/claude-shadcn-cli/bin/cli.js" init --yes --no-studio --figma --no-ai >/dev/null)
[ -f "$FIG/.claude/commands/ftc.md" ] || fail "/ftc missing without a Studio license"
[ ! -e "$FIG/.claude/commands/cui.md" ] || fail "/cui installed without a Studio license"
jq -e '.mcpServers | has("figma")' "$FIG/.mcp.json" >/dev/null || fail "figma-only .mcp.json is missing the Figma server"

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
