// Turns the template's markdown sources into project-specific files.
// Conditional blocks are wrapped in `<!-- name:start -->` / `<!-- name:end -->`
// lines; `[CUSTOMIZE]` markers that can be answered from components.json are
// replaced by exact-string match (tests assert every match target exists).

const REGION = /^<!-- ([\w-]+):start -->\n([\s\S]*?)^<!-- \1:end -->\n/gm

function applyRegions(text, keep) {
  return text.replace(REGION, (_, name, body) => (keep[name] ? applyRegions(body, keep) : ""))
}

function replaceExact(text, from, to) {
  if (!text.includes(from)) throw new Error(`Template marker not found: ${from.slice(0, 60)}…`)
  return text.replace(from, to)
}

const tidy = (text) => text.replace(/\n{3,}/g, "\n\n")

export const MANUAL_HINT =
  " Copying this file by hand instead? Fill in or delete each `[CUSTOMIZE]` marker and keep only the `name:start`/`name:end` region blocks that apply."
export const EXPORT_MARKER =
  "`[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components — or pick a different export convention and state it here; whatever is chosen, keep it consistent project-wide and call out any exceptions (e.g. page/route files following a framework's own convention)."
export const RSC_MARKER = "`[CUSTOMIZE — RSC frameworks only]` "
export const CSS_MARKER = "`[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`"
export const REFRESH_MARKER = "`[REFRESH-COMMAND]`"

const BIN_INVOCATION = "npx claude-shadcn-cli init"
const REPO_INVOCATION = "npx github:emersonr-dev/claude-shadcn-template init"

/**
 * How a given project should re-run `init`.
 *
 * `npx claude-shadcn-cli` is a *local bin*: npx resolves `node_modules/.bin` before
 * the registry, so the bare name only works where this package is a dependency. A
 * project set up with the one-off `npx github:…` form has no such bin, and npx falls
 * back to the registry — where this package is not published, so the command 404s.
 *
 * Printing the repo URL everywhere instead would defeat a pinned consumer's
 * `#semver:` range, because that form tracks the default branch rather than a tag.
 * So each project is told the one that is true for it.
 */
export function refreshCommand(installedAsDependency) {
  return installedAsDependency ? BIN_INVOCATION : REPO_INVOCATION
}

/** Renders `.claude/claude-shadcn.md` for a project. */
export function renderManagedMd(source, { studio, figma, rsc, cssFile, installedAsDependency }) {
  let text = applyRegions(source, { studio, "no-studio": !studio, figma, rsc })
  text = replaceExact(text, MANUAL_HINT, "")
  text = replaceExact(
    text,
    EXPORT_MARKER,
    "Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components; page/route files may follow the framework's own convention. Override this in CLAUDE.md if the project chose otherwise.",
  )
  if (rsc) text = replaceExact(text, RSC_MARKER, "")
  if (cssFile) text = replaceExact(text, CSS_MARKER, `\`${cssFile}\``)
  text = replaceExact(text, REFRESH_MARKER, `\`${refreshCommand(installedAsDependency)}\``)
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
