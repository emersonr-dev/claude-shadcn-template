// Turns the template's markdown sources into project-specific files.
// Conditional blocks are wrapped in `<!-- name:start -->` / `<!-- name:end -->`
// lines; `[CUSTOMIZE]` markers that can be answered from components.json are
// replaced by exact-string match (tests assert every match target exists).

const REGION = /^<!-- ([\w-]+):start -->\n([\s\S]*?)^<!-- \1:end -->\n/gm

function applyRegions(text, keep) {
  return text.replace(REGION, (_, name, body) => (keep[name] ? body : ""))
}

function replaceExact(text, from, to) {
  if (!text.includes(from)) throw new Error(`Template marker not found: ${from.slice(0, 60)}…`)
  return text.replace(from, to)
}

const tidy = (text) => text.replace(/\n{3,}/g, "\n\n")

export const MANUAL_HINT =
  " Copying this file by hand instead? Fill in or delete each `[CUSTOMIZE]` marker and keep only the `<!-- region -->` blocks that apply."
export const EXPORT_MARKER =
  "`[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components — or pick a different export convention and state it here; whatever is chosen, keep it consistent project-wide and call out any exceptions (e.g. page/route files following a framework's own convention)."
export const RSC_MARKER = "`[CUSTOMIZE — RSC frameworks only]` "
export const CSS_MARKER = "`[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`"

/** Renders `.claude/claude-shadcn.md` for a project. */
export function renderManagedMd(source, { studio, rsc, cssFile }) {
  let text = applyRegions(source, { studio, "no-studio": !studio, rsc })
  text = replaceExact(text, MANUAL_HINT, "")
  text = replaceExact(
    text,
    EXPORT_MARKER,
    "Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components; page/route files may follow the framework's own convention. Override this in CLAUDE.md if the project chose otherwise.",
  )
  if (rsc) text = replaceExact(text, RSC_MARKER, "")
  if (cssFile) text = replaceExact(text, CSS_MARKER, `\`${cssFile}\``)
  return tidy(text)
}

/** Renders the CLAUDE.md skeleton for a project that has none. */
export function renderSkeleton(source) {
  return tidy(source.replace(REGION, (match, name) => (name === "template-note" ? "" : match)))
}

/** Appended to an existing CLAUDE.md that doesn't import the managed file yet. */
export function importBlock(importPath) {
  return `\n## shadcn/ui conventions\n\nShared component conventions and workflow commands (managed by \`claude-shadcn-cli\`; override them here rather than editing the imported file):\n\n@${importPath}\n`
}
