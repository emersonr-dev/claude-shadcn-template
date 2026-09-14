# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Template note:** This is a starting skeleton for a React + shadcn/ui project — Next.js (App Router or Pages Router), Vite, Remix, Astro's React islands, TanStack Start, or any other React framework/setup shadcn/ui supports. Sections marked `[CUSTOMIZE]` need this project's own detail; everything else is a convention meant to hold across React frameworks. Delete this note once the file is filled in.

## Initial configuration

Environment variables (see `.env`, gitignored):

- `EMAIL` / `LICENSE_KEY` — Shadcn Studio registry auth, used by `components.json`'s `@ss-components`/`@ss-themes`/`@ss-blocks` registries. Required for the `/cui`, `/rui`, `/iui` commands below. If this project has no Shadcn Studio license, delete this line, drop those registries from `components.json`, and remove the `cui`/`rui`/`iui`/`ftc` commands — rely on the plain `npx shadcn@latest add` CLI instead (see the `component` skill's "Plain shadcn/ui installs" note).
- `[CUSTOMIZE]` — add this project's own required env vars (API keys, database URLs, auth secrets, etc.).

## Architecture

`[CUSTOMIZE]` — describe the framework and version this project actually runs (Next.js App Router, Next.js Pages Router, Vite SPA, Remix, TanStack Start, etc.), whether it uses React Server Components at all, state management, data-fetching approach, and any build/runtime behavior that changes how code must be written (e.g. Next.js `cacheComponents` requiring `"use cache"` or Suspense boundaries — framework-specific, delete if not applicable). Add a short subsection per major integration this project has (a CMS, an API layer, auth), the way a real project would.

### `[CUSTOMIZE]` — domain-specific pipelines

If this project has a recurring "add a new X" task (a CMS block type, a form field type, an API resource type, a new page template, etc.), write a dedicated skill for it under `.claude/skills/`, shaped as an extension contract:

- **Where things live** — the exact files involved and what each one is responsible for.
- **The contract** — the ordered list of files to touch, every time, to add a new instance.
- **Checklist** — one line per file/step, plus a reminder to re-check the skill against current source before relying on it (it's a pointer, not a guaranteed-current copy).

Point to canonical source files rather than duplicating their content, so the skill can't silently drift out of date as the code changes.

### Component conventions (see `.claude/skills/component` and its `references/`)

This is a shadcn/ui-first project — these rules are strict, not stylistic preferences:

- **Component hierarchy**: use an existing component in `components/ui/` → install a missing shadcn/ui component (`npx shadcn@latest add <name>`) → extend/compose shadcn/ui primitives → pure Tailwind `<div>`/`<button>` is forbidden when a shadcn/ui equivalent exists.
- Before writing or editing any UI component, consult the shadcn/studio MCP server (see `.claude/skills/component/SKILL.md` for the exact tool sequence) rather than hand-rolling from memory — unless this project has no Shadcn Studio license, in which case skip straight to the official `npx shadcn@latest add` CLI.
- `[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and `components/providers/*` components — or pick a different export convention and state it here; whatever is chosen, keep it consistent project-wide and call out any exceptions (e.g. page/route files following a framework's own convention).
- Always define and export a `Props` interface/type; accept and merge `className` via `cn()` from `@/lib/utils`.
- Add `data-slot="component-name"` on the root element.
- `[CUSTOMIZE — RSC frameworks only]` If this project uses React Server Components (Next.js App Router, or another RSC-capable framework): add `"use client"` only when the component needs hooks, event handlers, or browser APIs. Plain client-rendered React apps (Vite, CRA, a Pages Router-only Next.js app, etc.) have no such directive — delete this bullet entirely in that case.
- Use path aliases (`@/components/*`, `@/lib/*`, `@/hooks/*`, etc.) rather than relative `../../` imports.
- No hardcoded colors — use the CSS custom property tokens defined in `[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`.
- Placement: reusable primitives → `components/ui/`; feature/page-specific → `components/`; Shadcn Studio blocks → `components/shadcn-studio/blocks/`; context/providers → `components/providers/`. `[CUSTOMIZE]` adjust to this project's actual structure if it differs.

## shadcn/ui workflow commands

Four commands wrap the Shadcn Studio MCP server (`shadcn-studio-mcp`) for structured component work. Each command file is the source of truth for its own step order; `.claude/skills/component/references/shadcn-studio-workflow.md` covers the rules shared across all four.

| Situation | Command |
|---|---|
| Building a new block/page section | `/cui` |
| Editing/updating an existing component or block | `/rui` |
| Design inspiration only, nothing installed | `/iui` |
| Converting a Figma design to code | `/ftc` (needs a Figma MCP server configured separately — not included in this template) |

All four gate any install behind a comparison against what already exists in the project (don't silently reinstall or duplicate a component that already covers the request), and fall back to the plain `npx shadcn@latest add` CLI when the target is a stock component with no Shadcn Studio variant involved. See the reference doc for the exact rule.

## Other notes

`[CUSTOMIZE]` — theming approach, animation library conventions, testing setup, deployment notes, or anything else future-you or Claude needs to know that isn't derivable from reading the code.
