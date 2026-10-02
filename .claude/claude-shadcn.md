<!-- Managed by claude-shadcn-cli and imported from CLAUDE.md via `@.claude/claude-shadcn.md`. Re-running `npx claude-shadcn-cli init` refreshes this file; put project-specific overrides in CLAUDE.md instead of editing here. Copying this file by hand instead? Fill in or delete each `[CUSTOMIZE]` marker and keep only the `<!-- region -->` blocks that apply. -->

# shadcn/ui conventions

<!-- studio:start -->
## Shadcn Studio credentials

- `EMAIL` / `LICENSE_KEY` (in `.env`, gitignored) — Shadcn Studio registry auth, used by `components.json`'s `@ss-components`/`@ss-themes`/`@ss-blocks` registries. Required for the `/cui`, `/rui`, `/iui`, `/ftc` commands below.
<!-- studio:end -->

## Component conventions (see `.claude/skills/component` and its `references/`)

This is a shadcn/ui-first project — these rules are strict, not stylistic preferences:

- **Component hierarchy**: use an existing component in `components/ui/` → install a missing shadcn/ui component (`npx shadcn@latest add <name>`) → extend/compose shadcn/ui primitives → pure Tailwind `<div>`/`<button>` is forbidden when a shadcn/ui equivalent exists.
<!-- studio:start -->
- Before writing or editing any UI component, consult the shadcn/studio MCP server (see `.claude/skills/component/SKILL.md` for the exact tool sequence) rather than hand-rolling from memory.
<!-- studio:end -->
<!-- no-studio:start -->
- This project has no Shadcn Studio license: install and refresh components with the official `npx shadcn@latest add <name>` CLI only (see the `component` skill's "Plain shadcn/ui installs" note), and ignore the skill's Studio-specific steps.
<!-- no-studio:end -->
- `[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components — or pick a different export convention and state it here; whatever is chosen, keep it consistent project-wide and call out any exceptions (e.g. page/route files following a framework's own convention).
- Always define and export a `Props` interface/type; accept and merge `className` via `cn()` from `@/lib/utils`.
- Add `data-slot="component-name"` on the root element.
<!-- rsc:start -->
- `[CUSTOMIZE — RSC frameworks only]` This project uses React Server Components: add `"use client"` only when the component needs hooks, event handlers, or browser APIs.
<!-- rsc:end -->
- Use path aliases (`@/components/*`, `@/lib/*`, `@/hooks/*`, etc.) rather than relative `../../` imports.
- No hardcoded colors — use the CSS custom property tokens defined in `[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`.
- Placement: reusable primitives → `components/ui/`; feature/page-specific → `components/`; Shadcn Studio blocks → `components/shadcn-studio/blocks/`; context/providers → `components/providers/`.

<!-- studio:start -->
## shadcn/ui workflow commands

Four commands wrap the Shadcn Studio MCP server (`shadcn-studio-mcp`) for structured component work. Each command file is the source of truth for its own step order; `.claude/skills/component/references/shadcn-studio-workflow.md` covers the rules shared across all four.

| Situation | Command |
|---|---|
| Building a new block/page section | `/cui` |
| Editing/updating an existing component or block | `/rui` |
| Design inspiration only, nothing installed | `/iui` |
| Converting a Figma design to code | `/ftc` (needs a Figma MCP server configured separately — not included in this template) |

All four gate any install behind a comparison against what already exists in the project (don't silently reinstall or duplicate a component that already covers the request), and fall back to the plain `npx shadcn@latest add` CLI when the target is a stock component with no Shadcn Studio variant involved. See the reference doc for the exact rule.
<!-- studio:end -->
