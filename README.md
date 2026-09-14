# claude-shadcn-react-template

Reusable Claude Code setup for **any React-based project** using shadcn/ui — Next.js (App Router or Pages Router), Vite, Remix, TanStack Start, Astro's React islands, or plain React with manual setup. Four commands drive the [Shadcn Studio](https://shadcnstudio.com) MCP server through a consistent, hierarchy-respecting workflow, plus a `CLAUDE.md` skeleton to start a new project from.

Extracted from a working Next.js project's Claude Code setup after several iterations closed real gaps (installing before checking for reuse, no fallback to the plain shadcn/ui CLI, docs split across `.github/instructions/*` and `.claude/`, assumptions baked in that only held for Next.js App Router). Everything here is Claude-native — no dependency on Copilot-style `.github/instructions` files — and framework detail is either abstracted behind `[CUSTOMIZE]` markers or called out inline as "RSC frameworks only" / "Next.js only" where a convention genuinely doesn't generalize.

## What's in here

```
CLAUDE.md                                              # skeleton — fill in [CUSTOMIZE] sections
components.json.nextjs.example                         # shadcn/ui config for Next.js (rsc: true)
components.json.react.example                          # shadcn/ui config for Vite/CRA/other client-only React (rsc: false)
.claude/
├── settings.json                                      # MCP + bash permission allowlist
├── commands/
│   ├── cui.md                                         # /cui  — create a new block/section
│   ├── rui.md                                         # /rui  — refine/update an existing component
│   ├── iui.md                                         # /iui  — design inspiration only, nothing installed
│   └── ftc.md                                         # /ftc  — Figma design to code
└── skills/
    └── component/
        ├── SKILL.md                                   # entry point: which command to use, reference templates
        └── references/
            ├── shadcn-studio-workflow.md               # shared workflow rules + reuse-vs-install comparison gate
            └── figma-to-shadcn-mapping.md               # Figma element -> shadcn/ui component table
```

## Framework compatibility

shadcn/ui itself supports multiple React frameworks, and so does everything in this template — the commands and skill only ever call MCP tools or `npx shadcn@latest add`, neither of which is Next.js-specific. The two places that genuinely differ per framework are called out explicitly rather than papered over:

| Concern | Next.js App Router (or other RSC framework) | Vite / CRA / Pages Router / non-RSC |
|---|---|---|
| `components.json` | copy `components.json.nextjs.example` — `rsc: true` | copy `components.json.react.example` — `rsc: false` |
| `"use client"` directive | keep — required wherever a component uses hooks/events/browser APIs | delete entirely — this directive doesn't exist outside RSC |
| Image/asset allowlisting (`/ftc` only) | check `next.config`'s remote image domains | skip — most non-Next setups have no such allowlist |
| Page/route file (`/ftc` only) | `page.tsx` | this project's equivalent route/page component |

If a future React framework isn't Next.js or a plain Vite-style SPA, start from `components.json.react.example` and adjust `rsc`/`tailwind` per that framework's own shadcn/ui `init` support (shadcn/ui's docs list per-framework setup) — nothing else in this template needs to change, since the commands and skill don't reference a framework by name anywhere except the two spots in the table above.

## Using this in a new project

1. Copy `CLAUDE.md` and `.claude/` into the new repo's root.
2. Copy whichever `components.json.*.example` matches the framework (see table above) to `components.json`, if using Shadcn Studio.
3. Fill in every `[CUSTOMIZE]` block in `CLAUDE.md`: env vars, architecture/framework, export convention, colors file path, component placement, any domain-specific pipeline. Delete the `"use client"` bullet if the framework has no RSC.
4. If the project has a Shadcn Studio license: set `EMAIL`/`LICENSE_KEY` in `.env`, update `components.json`'s `tailwind.config`/`css` paths to match this project's actual file layout (a Tailwind v4 project using CSS-based config won't have a `tailwind.config.*` file at all — check current shadcn/ui `init` docs for the right shape).
5. If the project does **not** have a Shadcn Studio license: delete `.claude/commands/{cui,rui,iui,ftc}.md`, delete the Studio-specific sections of `.claude/skills/component/SKILL.md` and its `references/`, drop the `@ss-*` registries from `components.json`, and rely on `npx shadcn@latest add` directly — the skeleton `CLAUDE.md` already calls this branch out inline.
6. Adjust `.claude/settings.json`'s bash allowlist to the new project's actual package manager and scripts (`npm run build`/`lint` assumes npm — swap for `pnpm`/`yarn`/`bun` as needed).
7. If the project needs a recurring "add a new X" pipeline (a CMS block type, a form field type, etc.), write it as its own skill under `.claude/skills/` following the extension-contract shape described in `CLAUDE.md`'s "domain-specific pipelines" section — not included here since it's inherently project-specific.
8. Run `/init` in Claude Code afterward to have it fill in what it can from the actual codebase, then review.

## Design notes

- **Pointer, not copy.** `SKILL.md` and the reference docs point at the vendor's `get-*-instructions` MCP tools and at each other rather than embedding a frozen snapshot of behavior that can drift out of date.
- **Fetch → gate → install → convert.** Every command fetches metadata first (no side effects), runs the reuse-vs-install comparison gate against what's already in the project, and only then installs — never the reverse. This was a deliberate fix after an earlier version listed the install step before the hierarchy check, which read as "install then reconcile" on a literal pass.
- **Plain CLI fallback is explicit.** Shadcn Studio is a paid layer on top of the official shadcn/ui registry. Every doc that touches installs says outright: if the target is a stock component, skip Studio and use `npx shadcn@latest add` — don't route everything through the paid workflow by default.
- **Framework specifics are named, not assumed.** The one thing this template used to get wrong: React Server Components conventions (`"use client"`, `rsc: true`) were written as if every consumer would be a Next.js App Router project. They're now called out as conditional wherever they appear, so a Vite/CRA/Pages-Router project doesn't inherit dead instructions.
