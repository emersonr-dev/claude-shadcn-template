import { isDeepStrictEqual } from "node:util"

// The Studio MCP tools and the registry-scoped `npx shadcn add @ss-…` rules are
// both meaningless without a license, so they drop out together.
const STUDIO_PERMISSION = /^(?:mcp__shadcn-studio-mcp__|Bash\(npx shadcn@latest add @ss-)/
const FIGMA_PERMISSION = /^mcp__figma__/
const RUN_SCRIPT = /^Bash\(npm run ([\w:-]+)\)$/
const HOOK_SCRIPT = "check-shadcn-studio.sh"

/** Adapts the template's settings.json to the project (license, Figma, package manager, scripts). */
export function renderSettings(source, { studio, figma, packageManager, scripts }) {
  const settings = structuredClone(source)
  settings.permissions.allow = settings.permissions.allow.flatMap((rule) => {
    if (!studio && STUDIO_PERMISSION.test(rule)) return []
    if (!figma && FIGMA_PERMISSION.test(rule)) return []
    const run = rule.match(RUN_SCRIPT)
    if (!run) return [rule]
    return scripts[run[1]] ? [`Bash(${packageManager} run ${run[1]})`] : []
  })
  if (!studio) delete settings.hooks
  return settings
}

const isOurHookGroup = (group) =>
  Array.isArray(group.hooks) && group.hooks.length > 0 && group.hooks.every((h) => h.command?.includes(HOOK_SCRIPT))

/**
 * Additive merge into the project's existing settings.json: permission rules are
 * unioned; hook groups this tool owns (they call check-shadcn-studio.sh) are
 * replaced so re-runs and upgrades never duplicate them; everything else is kept.
 */
export function mergeSettings(existing, incoming) {
  const out = structuredClone(existing ?? {})
  for (const key of ["allow", "deny", "ask"]) {
    const rules = incoming.permissions?.[key]
    if (!rules) continue
    out.permissions ??= {}
    out.permissions[key] = [...new Set([...(out.permissions[key] ?? []), ...rules])]
  }
  for (const [event, groups] of Object.entries(incoming.hooks ?? {})) {
    out.hooks ??= {}
    const kept = (out.hooks[event] ?? []).filter((group) => !isOurHookGroup(group))
    out.hooks[event] = [...kept, ...groups]
  }
  return out
}

/** Adds missing Shadcn Studio registries; never overwrites an existing entry. */
export function mergeRegistries(componentsJson, snippet) {
  const out = structuredClone(componentsJson)
  const added = []
  const differing = []
  for (const [name, config] of Object.entries(snippet.registries)) {
    const current = out.registries?.[name]
    if (current === undefined) {
      out.registries ??= {}
      out.registries[name] = config
      added.push(name)
    } else if (!isDeepStrictEqual(current, config)) {
      differing.push(name)
    }
  }
  return { result: out, added, differing }
}

/** Appends each `line` whose `present` test fails; returns the original text when nothing is missing. */
export function ensureLines(text, entries) {
  const current = text ?? ""
  const missing = entries.filter(({ present }) => !present.test(current))
  if (missing.length === 0) return current
  const prefix = current === "" || current.endsWith("\n") ? current : current + "\n"
  return prefix + missing.map(({ line }) => line).join("\n") + "\n"
}

/** Leading major version of a semver range like "^4.1.0", "~3.4" or "4". Null when unparseable. */
export function majorVersion(range) {
  const match = String(range ?? "").match(/(\d+)/)
  return match ? Number(match[1]) : null
}

/**
 * shadcn picks which generation of component source to serve from components.json, and only
 * serves the v4 one — the generation carrying `data-slot` — when `tailwind.config` is `""`.
 * Tailwind v4 keeps its config in CSS, so a path left in that field points at a file that
 * usually doesn't exist; it is dead for Tailwind's purposes but still silently downgrades
 * every `shadcn add` to the pre-v4 `forwardRef` sources, which have no `data-slot` at all.
 * That contradicts the `data-slot` rule these conventions mandate, and nothing surfaces it.
 *
 * Only the provably-dead case is normalized: a v4 project whose `tailwind.config` names a
 * file that isn't on disk. When the file does exist the project may really be driving
 * Tailwind from it, so the caller warns instead and leaves the value alone.
 */
export function normalizeTailwindConfig(componentsJson) {
  const out = structuredClone(componentsJson)
  const previous = out.tailwind.config
  out.tailwind.config = ""
  return { result: out, previous }
}

/** Whether `tailwind.config` is a non-empty path, i.e. a candidate for the check above. */
export function hasTailwindConfigPath(componentsJson) {
  const config = componentsJson?.tailwind?.config
  return typeof config === "string" && config !== ""
}
