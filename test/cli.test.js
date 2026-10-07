import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { detectProject } from "../src/detect.js"
import { buildPlan } from "../src/plan.js"
import { applyPlan } from "../src/apply.js"
import { renderManagedMd, renderSkeleton, refreshCommand, MANUAL_HINT, EXPORT_MARKER, RSC_MARKER, CSS_MARKER, REFRESH_MARKER } from "../src/render.js"
import { mergeSettings, renderSettings } from "../src/merge.js"
import { mergeMcpJson, personalServers, FIGMA_SERVER } from "../src/mcp.js"
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
// `personal: {}` keeps tests independent of the MCP servers on the machine running them.
const planFor = (dir, studio, figma = studio, personal = {}) => buildPlan(dir, { studio, figma, personal, detection: detectProject(dir) })
const run = (dir, studio, figma = studio, personal = {}) => {
  const plan = planFor(dir, studio, figma, personal)
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
  for (const marker of [MANUAL_HINT, EXPORT_MARKER, RSC_MARKER, CSS_MARKER, REFRESH_MARKER]) assert.ok(source.includes(marker), marker)
})

test("render: the managed file's HTML comments never nest (a nested --> leaks text into Claude's context)", () => {
  const source = readFileSync(join(PKG_ROOT, ".claude/claude-shadcn.md"), "utf8")
  for (const comment of source.match(/<!--[\s\S]*?-->/g)) assert.ok(!comment.slice(4).includes("<!--"), comment)
})

test("render: managed file resolves markers and regions", () => {
  const source = readFileSync(join(PKG_ROOT, ".claude/claude-shadcn.md"), "utf8")
  const studioRsc = renderManagedMd(source, { studio: true, figma: true, rsc: true, cssFile: "app/globals.css" })
  assert.doesNotMatch(studioRsc, /CUSTOMIZE|REFRESH-COMMAND|:start -->|:end -->/)
  assert.match(studioRsc, /"use client"/)
  assert.match(studioRsc, /`\/cui`/)
  assert.match(studioRsc, /`app\/globals\.css`/)
  assert.match(studioRsc, /## Figma to code/)

  const plain = renderManagedMd(source, { studio: false, figma: false, rsc: false, cssFile: "src/index.css" })
  assert.doesNotMatch(plain, /"use client"|\/cui|\/ftc|EMAIL/)
  assert.match(plain, /no Shadcn Studio license/)

  const figmaOnly = renderManagedMd(source, { studio: false, figma: true, rsc: false, cssFile: "src/index.css" })
  assert.match(figmaOnly, /`\/ftc/)
  assert.doesNotMatch(figmaOnly, /\/cui|EMAIL/)
})

test("render: skeleton drops the template note but keeps the import", () => {
  const skeleton = renderSkeleton(readFileSync(join(PKG_ROOT, "CLAUDE.md"), "utf8"))
  assert.doesNotMatch(skeleton, /Template note/)
  assert.match(skeleton, /^@\.claude\/claude-shadcn\.md$/m)
})

test("settings: merge is additive, idempotent, and replaces only our hook groups", () => {
  const source = JSON.parse(readFileSync(join(PKG_ROOT, ".claude/settings.json"), "utf8"))
  const incoming = renderSettings(source, { studio: true, figma: true, packageManager: "pnpm", scripts: { build: "x" } })
  assert.ok(incoming.permissions.allow.includes("Bash(pnpm run build)"))
  assert.ok(!incoming.permissions.allow.some((r) => r.includes("lint")))
  assert.ok(incoming.permissions.allow.includes("mcp__figma__get_design_context"))
  assert.ok(!incoming.permissions.allow.some((r) => /^mcp__figma__(use_figma|upload_assets|generate_)/.test(r)), "Figma write tools must still ask")

  const theirs = { permissions: { allow: ["Bash(git status)"] }, hooks: { PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "mine.sh" }] }] } }
  const once = mergeSettings(theirs, incoming)
  assert.deepEqual(mergeSettings(once, incoming), once)
  assert.ok(once.permissions.allow.includes("Bash(git status)"))
  assert.equal(once.hooks.PreToolUse.length, 1 + incoming.hooks.PreToolUse.length)

  const noStudio = renderSettings(source, { studio: false, figma: false, packageManager: "npm", scripts: {} })
  assert.ok(!noStudio.permissions.allow.some((r) => r.startsWith("mcp__figma__")))
  assert.equal(noStudio.hooks, undefined)
  assert.ok(!noStudio.permissions.allow.some((r) => r.startsWith("mcp__shadcn-studio")))
  assert.ok(!noStudio.permissions.allow.some((r) => r.includes("@ss-")), "Studio registry installs must drop without a license")
})

test("settings: nothing that writes is pre-approved", () => {
  const allow = JSON.parse(readFileSync(join(PKG_ROOT, ".claude/settings.json"), "utf8")).permissions.allow

  // A wildcard would also cover install-theme (it rewrites globals.css wholesale)
  // and every tool the server adds in future versions.
  assert.ok(!allow.some((r) => r.endsWith("*") && !r.includes("(")), "no bare MCP wildcards")

  // The install-capable Studio tools are exactly the ones the PreToolUse hook
  // matches; the allowlist must not short-circuit that gate.
  const hook = JSON.parse(readFileSync(join(PKG_ROOT, ".claude/settings.json"), "utf8")).hooks.PreToolUse[0]
  for (const gated of hook.matcher.split("|")) {
    assert.ok(!allow.includes(gated), `${gated} is hook-gated and must not be pre-approved`)
  }

  // `shadcn add` accepts a URL, so an open-ended rule pre-approves arbitrary
  // registry JSON writing files anywhere in the project.
  assert.ok(!allow.includes("Bash(npx shadcn@latest add:*)"), "open-ended shadcn add must not be pre-approved")
  for (const r of allow.filter((r) => r.startsWith("Bash(npx shadcn"))) {
    assert.match(r, /^Bash\(npx shadcn@latest add @ss-(components|blocks|themes)\/:\*\)$/)
  }
})

test("plan: fresh project gets everything, second run is a no-op", () => {
  const dir = project(nextApp())
  const { plan } = run(dir, true)
  assert.ok(plan.actions.some((a) => a.createdClaudeMd))
  assert.ok(existsSync(join(dir, ".claude/commands/cui.md")))
  assert.ok(statSync(join(dir, ".claude/hooks/check-shadcn-studio.sh")).mode & 0o100)
  assert.ok(JSON.parse(read(dir, "components.json")).registries["@ss-components"])
  assert.match(read(dir, ".gitignore"), /^\.claude\/settings\.local\.json$/m)
  assert.match(read(dir, ".gitignore"), /^!\.env\.example$/m)

  assert.ok(existsSync(join(dir, ".claude/commands/ftc.md")))
  assert.deepEqual(JSON.parse(read(dir, ".mcp.json")).mcpServers.figma, FIGMA_SERVER)
  assert.match(JSON.parse(read(dir, ".mcp.json")).mcpServers["shadcn-studio-mcp"].args.join(" "), /\$\{SHADCN_STUDIO_API_KEY:-\}/)

  const second = planFor(dir, true)
  assert.deepEqual(second.actions.filter((a) => a.kind !== "unchanged"), [])
})

test("gitignore: a blanket .env* does not swallow the .env.example we write", () => {
  // create-next-app's default .gitignore. The `.env` entry is already satisfied
  // by `.env*`, so without the negation nothing gets appended and the
  // placeholders never reach the repo.
  const dir = project({ ...nextApp(), ".gitignore": "node_modules\n.env*\n" })
  run(dir, true)
  const gitignore = read(dir, ".gitignore")
  assert.match(gitignore, /^!\.env\.example$/m)
  assert.ok(gitignore.indexOf("!.env.example") > gitignore.indexOf(".env*"), "negation must come after the pattern it undoes")
  assert.ok(existsSync(join(dir, ".env.example")))

  // Without a license the CLI writes no .env.example, so it adds no negation.
  const noStudio = project({ ...nextApp(), ".gitignore": "node_modules\n.env*\n" })
  run(noStudio, false)
  assert.doesNotMatch(read(noStudio, ".gitignore"), /!\.env\.example/)
})

test("plan: without a license or Figma, Studio and Figma files are skipped", () => {
  const dir = project(nextApp())
  run(dir, false)
  assert.ok(!existsSync(join(dir, ".claude/commands")))
  assert.ok(!existsSync(join(dir, ".mcp.json")))
  assert.ok(!existsSync(join(dir, ".claude/skills/component/references/figma-to-shadcn-mapping.md")))
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
  assert.equal(kinds(planFor(dir, true))[".claude/commands/cui.md"], "update")
})

test("plan: Figma without a license installs /ftc only, for the fallback path", () => {
  const dir = project(nextApp())
  run(dir, false, true)
  assert.ok(existsSync(join(dir, ".claude/commands/ftc.md")))
  assert.ok(!existsSync(join(dir, ".claude/commands/cui.md")))
  assert.ok(!existsSync(join(dir, ".claude/hooks")))
  assert.deepEqual(Object.keys(JSON.parse(read(dir, ".mcp.json")).mcpServers), ["figma"])
  assert.ok(JSON.parse(read(dir, ".claude/settings.json")).permissions.allow.includes("mcp__figma__get_metadata"))
})

test("mcp: never duplicates or edits servers the project or the user already has", () => {
  const theirs = { mcpServers: { design: { type: "http", url: "https://mcp.figma.com/mcp" }, db: { command: "x" } } }
  const { result, added } = mergeMcpJson(theirs, { figma: true, studio: true, personal: { "shadcn-studio-mcp": { command: "npx" } } })
  assert.deepEqual(added, [])
  assert.deepEqual(result, theirs)

  const dir = project({ ...nextApp(), ".mcp.json": { mcpServers: { db: { command: "x" } } } })
  run(dir, true, true)
  assert.deepEqual(Object.keys(JSON.parse(read(dir, ".mcp.json")).mcpServers), ["db", "figma", "shadcn-studio-mcp"])
})

test("mcp: reads user- and local-scope servers from ~/.claude.json", () => {
  const dir = project({ "claude.json": { mcpServers: { a: {} }, projects: { "/proj": { mcpServers: { b: {} } } } } })
  assert.deepEqual(Object.keys(personalServers("/proj", join(dir, "claude.json"))), ["a", "b"])
  assert.deepEqual(personalServers("/proj", join(dir, "missing.json")), {})
})

// shadcn only serves the v4 component sources (the ones with `data-slot`) when
// components.json's `tailwind.config` is "". A leftover path there is dead for
// Tailwind v4, which configures itself in CSS, but it silently downgrades every
// `shadcn add` to the pre-v4 forwardRef sources.
const v4App = (config, extra = {}) => ({
  ...nextApp(),
  "package.json": {
    dependencies: { next: "15.0.0", react: "19.0.0" },
    devDependencies: { tailwindcss: "^4.1.0" },
    scripts: { build: "next build" },
  },
  "components.json": { rsc: true, style: "new-york", tailwind: { config, css: "app/globals.css" } },
  ...extra,
})

test("components.json: clears a dead tailwind.config so shadcn serves the v4 sources", () => {
  const dir = project(v4App("tailwind.config.ts"))
  const { plan } = run(dir, true)
  assert.equal(JSON.parse(read(dir, "components.json")).tailwind.config, "")
  assert.match(plan.actions.find((a) => a.path === "components.json").reason, /clear dead tailwind\.config/)
  // and the registries still land in the same single write
  assert.ok(JSON.parse(read(dir, "components.json")).registries["@ss-components"])
})

test("components.json: the v4 fix does not need a Studio license", () => {
  const dir = project(v4App("tailwind.config.ts"))
  run(dir, false)
  const after = JSON.parse(read(dir, "components.json"))
  assert.equal(after.tailwind.config, "")
  assert.equal(after.registries, undefined)
})

test("components.json: warns, and changes nothing, when the tailwind config really exists", () => {
  const dir = project({ ...v4App("tailwind.config.ts"), "tailwind.config.ts": "export default {}\n" })
  const plan = planFor(dir, true)
  assert.match(plan.warnings.join("\n"), /points tailwind\.config at tailwind\.config\.ts, which exists/)
  assert.equal(JSON.parse(read(dir, "components.json")).tailwind.config, "tailwind.config.ts")
})

test("components.json: Tailwind v3 projects and already-empty configs are left alone", () => {
  const v3 = project({
    ...v4App("tailwind.config.ts"),
    "package.json": {
      dependencies: { next: "15.0.0", react: "19.0.0" },
      devDependencies: { tailwindcss: "^3.4.0" },
      scripts: {},
    },
  })
  assert.equal(kinds(planFor(v3, false))["components.json"], "unchanged")

  const already = project(v4App(""))
  assert.equal(kinds(planFor(already, false))["components.json"], "unchanged")
})

test("conventions: cn is imported from the cn npm package, as shadcn's own tools write it", () => {
  const managed = readFileSync(join(PKG_ROOT, ".claude/claude-shadcn.md"), "utf8")
  assert.match(managed, /import \{ cn \} from "cn"/)
  assert.match(managed, /resolves from `node_modules`/)
  const skill = readFileSync(join(PKG_ROOT, ".claude/skills/component/SKILL.md"), "utf8")
  assert.ok(!skill.includes('import { cn } from "@/lib/utils"'), "skill examples must not import cn from @/lib/utils")
  assert.match(skill, /import \{ cn \} from "cn"/)
})

// `npx claude-shadcn-cli` resolves node_modules/.bin before the registry, so the bare
// name works only where this package is a dependency. Projects set up with the one-off
// `npx github:…` form have no such bin and npx falls back to the registry, where this
// package is unpublished — so each project has to be told the invocation that is true
// for it, rather than one hardcoded guess.
test("refresh command: the bare bin for a dependency, the repo URL otherwise", () => {
  assert.equal(refreshCommand(true), "npx claude-shadcn-cli init")
  assert.equal(refreshCommand(false), "npx github:emersonr-dev/claude-shadcn-template init")
})

test("detect: spots this package in the target project's dependencies", () => {
  assert.equal(detectProject(project(nextApp())).installedAsDependency, false)
  const asDep = project({
    ...nextApp(),
    "package.json": {
      dependencies: { next: "15.0.0", react: "19.0.0" },
      devDependencies: { "claude-shadcn-cli": "github:emersonr-dev/claude-shadcn-template#semver:^0.2.0" },
    },
  })
  assert.equal(detectProject(asDep).installedAsDependency, true)
})

test("refresh command: reaches both the managed file and the merge checklist", () => {
  const oneOff = project(nextApp())
  run(oneOff, true)
  assert.match(read(oneOff, ".claude/claude-shadcn.md"), /npx github:emersonr-dev\/claude-shadcn-template init/)
  assert.doesNotMatch(read(oneOff, ".claude/claude-shadcn.md"), /npx claude-shadcn-cli init/)

  // A project that pinned this package as a devDependency keeps using its own copy.
  const asDep = project({
    ...nextApp(),
    "package.json": {
      dependencies: { next: "15.0.0", react: "19.0.0" },
      devDependencies: { "claude-shadcn-cli": "github:emersonr-dev/claude-shadcn-template#semver:^0.2.0" },
    },
    // an edited CLAUDE.md forces a conflict, so MERGE.md gets written too
    "CLAUDE.md": "# Mine\n\n@.claude/claude-shadcn.md\n",
    ".claude/claude-shadcn.md": "stale, hand-edited\n",
  })
  const { conflicts } = run(asDep, true)
  assert.ok(conflicts.some((c) => c.path === ".claude/claude-shadcn.md"), "expected a conflict to produce MERGE.md")
  assert.match(read(asDep, `${INCOMING_DIR}/MERGE.md`), /npx claude-shadcn-cli init/)
  assert.doesNotMatch(read(asDep, `${INCOMING_DIR}/MERGE.md`), /npx github:/)
})
