import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { detectProject } from "../src/detect.js"
import { buildPlan } from "../src/plan.js"
import { applyPlan } from "../src/apply.js"
import { renderManagedMd, renderSkeleton, MANUAL_HINT, EXPORT_MARKER, RSC_MARKER, CSS_MARKER } from "../src/render.js"
import { mergeSettings, renderSettings } from "../src/merge.js"
import { PKG_ROOT, INCOMING_DIR, sha256 } from "../src/util.js"

function project(files) {
  const dir = mkdtempSync(join(tmpdir(), "claude-shadcn-"))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), typeof content === "string" ? content : JSON.stringify(content, null, 2))
  }
  return dir
}

const nextApp = () => ({
  "package.json": { dependencies: { next: "15.0.0", react: "19.0.0" }, scripts: { build: "next build", lint: "eslint ." } },
  "pnpm-lock.yaml": "",
  "app/page.tsx": "",
  "components.json": { rsc: true, tailwind: { css: "app/globals.css" } },
})

const read = (dir, path) => readFileSync(join(dir, path), "utf8")
const kinds = (plan) => Object.fromEntries(plan.actions.map((a) => [a.path, a.kind]))
const run = (dir, studio) => {
  const plan = buildPlan(dir, { studio, detection: detectProject(dir) })
  return { plan, conflicts: applyPlan(dir, plan) }
}

test("detect: rejects projects without package.json or react", () => {
  assert.equal(detectProject(project({})).status, "incompatible")
  assert.equal(detectProject(project({ "package.json": { dependencies: { vue: "3" } } })).status, "incompatible")
})

test("detect: React without components.json needs shadcn init", () => {
  const d = detectProject(project({ "package.json": { dependencies: { react: "19", vite: "6" } } }))
  assert.equal(d.status, "needs-shadcn-init")
  assert.equal(d.framework, "Vite")
})

test("detect: reads framework, package manager, rsc and css from the project", () => {
  const d = detectProject(project(nextApp()))
  assert.equal(d.status, "ok")
  assert.equal(d.framework, "Next.js (App Router)")
  assert.equal(d.packageManager, "pnpm")
  assert.equal(d.rsc, true)
  assert.equal(d.cssFile, "app/globals.css")
})

test("render: every marker the CLI replaces exists in the template", () => {
  const source = readFileSync(join(PKG_ROOT, ".claude/claude-shadcn.md"), "utf8")
  for (const marker of [MANUAL_HINT, EXPORT_MARKER, RSC_MARKER, CSS_MARKER]) assert.ok(source.includes(marker), marker)
})

test("render: managed file resolves markers and regions", () => {
  const source = readFileSync(join(PKG_ROOT, ".claude/claude-shadcn.md"), "utf8")
  const studioRsc = renderManagedMd(source, { studio: true, rsc: true, cssFile: "app/globals.css" })
  assert.doesNotMatch(studioRsc, /CUSTOMIZE|:start -->|:end -->/)
  assert.match(studioRsc, /"use client"/)
  assert.match(studioRsc, /`\/cui`/)
  assert.match(studioRsc, /`app\/globals\.css`/)

  const plain = renderManagedMd(source, { studio: false, rsc: false, cssFile: "src/index.css" })
  assert.doesNotMatch(plain, /"use client"|\/cui|EMAIL/)
  assert.match(plain, /no Shadcn Studio license/)
})

test("render: skeleton drops the template note but keeps the import", () => {
  const skeleton = renderSkeleton(readFileSync(join(PKG_ROOT, "CLAUDE.md"), "utf8"))
  assert.doesNotMatch(skeleton, /Template note/)
  assert.match(skeleton, /^@\.claude\/claude-shadcn\.md$/m)
})

test("settings: merge is additive, idempotent, and replaces only our hook groups", () => {
  const source = JSON.parse(readFileSync(join(PKG_ROOT, ".claude/settings.json"), "utf8"))
  const incoming = renderSettings(source, { studio: true, packageManager: "pnpm", scripts: { build: "x" } })
  assert.ok(incoming.permissions.allow.includes("Bash(pnpm run build)"))
  assert.ok(!incoming.permissions.allow.some((r) => r.includes("lint")))

  const theirs = { permissions: { allow: ["Bash(git status)"] }, hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "mine.sh" }] }] } }
  const once = mergeSettings(theirs, incoming)
  assert.deepEqual(mergeSettings(once, incoming), once)
  assert.ok(once.permissions.allow.includes("Bash(git status)"))
  assert.equal(once.hooks.PreToolUse.length, 1 + incoming.hooks.PreToolUse.length)

  const noStudio = renderSettings(source, { studio: false, packageManager: "npm", scripts: {} })
  assert.equal(noStudio.hooks, undefined)
  assert.ok(!noStudio.permissions.allow.some((r) => r.startsWith("mcp__shadcn-studio")))
})

test("plan: fresh project gets everything, second run is a no-op", () => {
  const dir = project(nextApp())
  const { plan } = run(dir, true)
  assert.ok(plan.actions.some((a) => a.createdClaudeMd))
  assert.ok(existsSync(join(dir, ".claude/commands/cui.md")))
  assert.ok(statSync(join(dir, ".claude/hooks/check-shadcn-studio.sh")).mode & 0o100)
  assert.ok(JSON.parse(read(dir, "components.json")).registries["@ss-components"])
  assert.match(read(dir, ".gitignore"), /^\.claude\/settings\.local\.json$/m)

  const second = buildPlan(dir, { studio: true, detection: detectProject(dir) })
  assert.deepEqual(second.actions.filter((a) => a.kind !== "unchanged"), [])
})

test("plan: without a license, Studio files are skipped", () => {
  const dir = project(nextApp())
  run(dir, false)
  assert.ok(!existsSync(join(dir, ".claude/commands")))
  assert.ok(!existsSync(join(dir, ".claude/hooks")))
  assert.ok(existsSync(join(dir, ".claude/skills/component/SKILL.md")))
  assert.equal(JSON.parse(read(dir, "components.json")).registries, undefined)
})

test("plan: existing CLAUDE.md only gains the import line, once", () => {
  const dir = project({ ...nextApp(), "CLAUDE.md": "# My project\n\nOur rules.\n" })
  run(dir, true)
  const after = read(dir, "CLAUDE.md")
  assert.ok(after.startsWith("# My project\n\nOur rules.\n"))
  assert.equal(after.match(/^@\.claude\/claude-shadcn\.md$/gm).length, 1)
  run(dir, true)
  assert.equal(read(dir, "CLAUDE.md"), after)
})

test("plan: user-edited files become conflicts and are never overwritten", () => {
  const dir = project({ ...nextApp(), ".claude/commands/cui.md": "my own cui\n" })
  const { conflicts } = run(dir, true)
  assert.deepEqual(conflicts.map((c) => c.path), [".claude/commands/cui.md"])
  assert.equal(read(dir, ".claude/commands/cui.md"), "my own cui\n")
  assert.equal(read(dir, `${INCOMING_DIR}/.claude/commands/cui.md`), read(PKG_ROOT, ".claude/commands/cui.md"))
  assert.match(read(dir, `${INCOMING_DIR}/MERGE.md`), /\.claude\/commands\/cui\.md/)
})

test("plan: files we installed and the user never touched are updated in place", () => {
  const dir = project(nextApp())
  run(dir, true)
  // Simulate an older template version that we installed earlier: the manifest
  // hash matches what's on disk, but the template now ships something else.
  const manifestPath = join(dir, ".claude/.claude-shadcn-manifest.json")
  const manifest = JSON.parse(read(dir, ".claude/.claude-shadcn-manifest.json"))
  writeFileSync(join(dir, ".claude/commands/cui.md"), "old template version\n")
  manifest.files[".claude/commands/cui.md"] = sha256("old template version\n")
  writeFileSync(manifestPath, JSON.stringify(manifest))
  assert.equal(kinds(buildPlan(dir, { studio: true, detection: detectProject(dir) }))[".claude/commands/cui.md"], "update")
})
