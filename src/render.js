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

// Which primitive library a project is on decides how a wrapper around one is
// written: the import path, the props types and the part names all differ
// (Radix `Overlay`/`Content` vs. Base UI `Backdrop`/`Popup`, `asChild` vs.
// `render`). So each project is shown only its own template — and a project
// whose base can't be read from components.json is shown all of them, which is
// still better than being handed one base's template as if it were universal.
const BASES = ["radix", "base", "aria"]

function baseRegions(base) {
  const known = BASES.includes(base)
  return Object.fromEntries(BASES.map((name) => [`primitive-${name}`, known ? name === base : true]))
}

const BASE_SENTENCES = {
  radix: "This project's `components.json` uses a `radix-*` style, so `components/ui/*` wraps **Radix UI** primitives — import them from the unified `radix-ui` package, not the per-package `@radix-ui/react-*` modules the pre-2026 sources used.",
  base: "This project's `components.json` uses a `base-*` style, so `components/ui/*` wraps **Base UI** primitives — import them from `@base-ui/react/<primitive>`, and compose with the `render` prop (Base UI has no `asChild`).",
  aria: "This project's `components.json` uses an `aria-*` style, so `components/ui/*` wraps **React Aria** — import from `react-aria-components` and compose with its render props and `slot` wiring.",
}

const UNKNOWN_BASE_SENTENCE =
  "Check which primitive library this project uses before hand-writing a wrapper around one — `components.json`'s `style` field names it (`radix-*` for Radix UI, `base-*` for Base UI, `aria-*` for React Aria), and `npx shadcn@latest info --json` reports it too."

export const MANUAL_HINT =
  " Copying this file by hand instead? Fill in or delete each `[CUSTOMIZE]` marker and keep only the `name:start`/`name:end` region blocks that apply."
export const EXPORT_MARKER =
  "`[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components — or pick a different export convention and state it here; whatever is chosen, keep it consistent project-wide and call out any exceptions (e.g. page/route files following a framework's own convention)."
export const RSC_MARKER = "`[CUSTOMIZE — RSC frameworks only]` "
export const CSS_MARKER = "`[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`"
export const REFRESH_MARKER = "`[REFRESH-COMMAND]`"
export const BASE_MARKER = "`[PRIMITIVE-BASE]`"

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

/**
 * Renders a copied markdown file (the commands and the `component` skill) for a project.
 *
 * These files carry no `[CUSTOMIZE]` markers — they're reference docs, not a
 * conventions file the project fills in — but they do describe workflows that
 * only some projects get, so they need the same region handling. Without it a
 * `--no-figma` project is handed a skill that documents `/ftc` and points at a
 * mapping reference neither of which it has.
 */
export function renderCopiedMd(source, { studio, figma, rsc, base }) {
  return tidy(applyRegions(source, { studio, "no-studio": !studio, figma, "no-figma": !figma, rsc, ...baseRegions(base) }))
}

/** Renders `.claude/claude-shadcn.md` for a project. */
export function renderManagedMd(source, { studio, figma, rsc, base, cssFile, installedAsDependency }) {
  let text = applyRegions(source, { studio, "no-studio": !studio, figma, "no-figma": !figma, rsc, ...baseRegions(base) })
  text = replaceExact(text, MANUAL_HINT, "")
  text = replaceExact(
    text,
    EXPORT_MARKER,
    "Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components; page/route files may follow the framework's own convention. Override this in CLAUDE.md if the project chose otherwise.",
  )
  if (rsc) text = replaceExact(text, RSC_MARKER, "")
  if (cssFile) text = replaceExact(text, CSS_MARKER, `\`${cssFile}\``)
  text = replaceExact(text, BASE_MARKER, BASE_SENTENCES[base] ?? UNKNOWN_BASE_SENTENCE)
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
