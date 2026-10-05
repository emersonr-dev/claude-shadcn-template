import { join } from "node:path"
import { renderManagedMd, renderSkeleton, importBlock } from "./render.js"
import { renderSettings, mergeSettings, mergeRegistries, ensureLines } from "./merge.js"
import { MCP_JSON, mergeMcpJson, personalServers } from "./mcp.js"
import { PKG_ROOT, MANAGED_MD, MANIFEST, listFiles, readJson, readText, sha256, toJson } from "./util.js"

const COPIED_DIRS = [".claude/commands", ".claude/hooks", ".claude/skills"]
const FIGMA_FILES = [".claude/commands/ftc.md", ".claude/skills/component/references/figma-to-shadcn-mapping.md"]

/** Which template files a project gets: Figma files follow `figma`, other commands and the hook follow `studio`. */
function included(path, { studio, figma }) {
  if (FIGMA_FILES.includes(path)) return figma
  if (path.startsWith(".claude/commands/") || path.startsWith(".claude/hooks/")) return studio
  return true
}

/** Reads the manifest left by a previous run (hashes of files this tool installed). */
export function readManifest(cwd) {
  try {
    return readJson(join(cwd, MANIFEST)) ?? { files: {} }
  } catch {
    return { files: {} }
  }
}

/**
 * A file this tool owns outright. Never overwrites the user's edits: if the
 * target differs from what we'd install and from what we installed last time,
 * it's a conflict for the user (or their agent) to merge.
 */
function classifyOwned(cwd, manifest, path, content, mode) {
  const current = readText(join(cwd, path))
  const base = { path, content, mode, owned: true }
  if (current === undefined) return { ...base, kind: "create" }
  if (current === content) return { ...base, kind: "unchanged" }
  if (manifest.files[path] === sha256(current)) return { ...base, kind: "update", reason: "unmodified since last install" }
  return { ...base, kind: "conflict", reason: "differs from the template version" }
}

function classifyMerged(cwd, path, before, after, reason) {
  if (before === after) return { path, kind: "unchanged" }
  return { path, kind: before === undefined ? "create" : "merge", content: after, reason }
}

/**
 * Computes every change `init` would make, without touching the filesystem.
 * `options`: { studio, figma, detection, personal? } — detection from detectProject;
 * personal = MCP servers already configured outside the project (defaults to ~/.claude.json).
 */
export function buildPlan(cwd, { studio, figma, detection, personal = personalServers(cwd) }) {
  const manifest = readManifest(cwd)
  const actions = []
  const warnings = []
  const src = (path) => readText(join(PKG_ROOT, path))

  // 1. Commands, hooks, skills — copied as-is.
  for (const path of COPIED_DIRS.flatMap((dir) => listFiles(PKG_ROOT, dir)).filter((p) => included(p, { studio, figma }))) {
    const mode = path.endsWith(".sh") ? 0o755 : undefined
    actions.push(classifyOwned(cwd, manifest, path, src(path), mode))
  }

  // 2. The managed conventions file CLAUDE.md imports.
  const managed = renderManagedMd(src(MANAGED_MD), { ...detection, studio, figma })
  actions.push(classifyOwned(cwd, manifest, MANAGED_MD, managed))

  // 3. CLAUDE.md — create the skeleton, or add a single @import line to the user's own.
  const claudeMdPath = detection.claudeMdPath ?? "CLAUDE.md"
  const importPath = claudeMdPath === "CLAUDE.md" ? MANAGED_MD : "claude-shadcn.md"
  const claudeMd = readText(join(cwd, claudeMdPath))
  if (claudeMd === undefined) {
    actions.push({ path: claudeMdPath, kind: "create", content: renderSkeleton(src("CLAUDE.md")), createdClaudeMd: true })
  } else {
    const hasImport = new RegExp(`^@(\\./)?${importPath.replace(/[.]/g, "\\.")}\\s*$`, "m").test(claudeMd)
    const after = hasImport ? claudeMd : claudeMd.replace(/\n*$/, "\n") + importBlock(importPath)
    actions.push(classifyMerged(cwd, claudeMdPath, claudeMd, after, `add @${importPath} import`))
  }

  // 4. settings.json — additive JSON merge.
  const settingsPath = ".claude/settings.json"
  const incomingSettings = renderSettings(JSON.parse(src(settingsPath)), { ...detection, studio, figma })
  const settingsText = readText(join(cwd, settingsPath))
  let existingSettings
  try {
    existingSettings = settingsText === undefined ? undefined : JSON.parse(settingsText)
  } catch {
    actions.push({ path: settingsPath, kind: "conflict", content: toJson(incomingSettings), reason: "existing file is not valid JSON" })
  }
  if (settingsText === undefined || existingSettings) {
    const merged = toJson(mergeSettings(existingSettings, incomingSettings))
    const unchanged = existingSettings && toJson(existingSettings) === merged
    actions.push(classifyMerged(cwd, settingsPath, settingsText, unchanged ? settingsText : merged, "add permissions/hooks"))
  }

  // 5. Shadcn Studio registries + env placeholders.
  if (studio) {
    const { result, added, differing } = mergeRegistries(detection.componentsJson, JSON.parse(src("components.registries.snippet.json")))
    const before = readText(join(cwd, "components.json"))
    actions.push(classifyMerged(cwd, "components.json", before, added.length ? toJson(result) : before, `add ${added.join(", ")} registries`))
    for (const name of differing) warnings.push(`components.json already defines ${name} differently; left as-is.`)

    const env = readText(join(cwd, ".env.example"))
    const envAfter = ensureLines(env, [
      { line: "EMAIL=", present: /^EMAIL=/m },
      { line: "LICENSE_KEY=", present: /^LICENSE_KEY=/m },
    ])
    actions.push(classifyMerged(cwd, ".env.example", env, envAfter, "add Shadcn Studio placeholders"))
  }

  // 6. .mcp.json — project-scoped MCP servers, so teammates get them too.
  if (figma || studio) {
    const mcpText = readText(join(cwd, MCP_JSON))
    let existingMcp
    try {
      existingMcp = mcpText === undefined ? undefined : JSON.parse(mcpText)
    } catch {
      warnings.push(`${MCP_JSON} is not valid JSON; left as-is. Add the Figma server yourself: claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp`)
    }
    if (mcpText === undefined || existingMcp) {
      const { result, added } = mergeMcpJson(existingMcp, { figma, studio, personal })
      actions.push({ ...classifyMerged(cwd, MCP_JSON, mcpText, added.length ? toJson(result) : mcpText, `add ${added.join(", ")} MCP server`), servers: added })
    }
  }

  // 7. .gitignore — keep secrets and personal settings out of git.
  const gitignore = readText(join(cwd, ".gitignore"))
  const gitignoreAfter = ensureLines(gitignore, [
    { line: ".env", present: /^\/?\.env\*?$/m },
    { line: ".claude/settings.local.json", present: /^\/?\.claude\/settings\.local\.json$/m },
  ])
  actions.push(classifyMerged(cwd, ".gitignore", gitignore, gitignoreAfter, "ignore .env and personal Claude settings"))

  return { actions, warnings, studio, figma }
}
