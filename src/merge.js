import { isDeepStrictEqual } from "node:util"

const STUDIO_PERMISSION = /^mcp__shadcn-studio-mcp__/
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
