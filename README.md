# claude-shadcn-nextjs-template

Reusable Claude Code setup for Next.js/React + shadcn/ui projects: four commands that drive the [Shadcn Studio](https://shadcnstudio.com) MCP server through a consistent, hierarchy-respecting workflow, plus a `CLAUDE.md` skeleton to start a new project from.

Extracted from a working project's Claude Code setup after several iterations closed real gaps (installing before checking for reuse, no fallback to the plain shadcn/ui CLI, docs split across `.github/instructions/*` and `.claude/`). Everything here is Claude-native — no dependency on Copilot-style `.github/instructions` files.

## What's in here

```
CLAUDE.md                                              # skeleton — fill in [CUSTOMIZE] sections
components.json.example                                # shadcn/ui + Shadcn Studio registry config
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

## Using this in a new project

1. Copy `CLAUDE.md`, `.claude/`, and (if using Shadcn Studio) `components.json.example` → `components.json` into the new repo's root.
2. Fill in every `[CUSTOMIZE]` block in `CLAUDE.md`: env vars, architecture, export convention, colors file path, component placement, any domain-specific pipeline.
3. If the project has a Shadcn Studio license: set `EMAIL`/`LICENSE_KEY` in `.env`, update `components.json`'s `tailwind.config`/`css` paths to match this project's actual setup (a Tailwind v4 project using CSS-based config won't have a `tailwind.config.*` file — check current shadcn/ui `init` docs for the right shape).
4. If the project does **not** have a Shadcn Studio license: delete `.claude/commands/{cui,rui,iui,ftc}.md`, delete the Studio-specific sections of `.claude/skills/component/SKILL.md` and its `references/`, drop the `@ss-*` registries from `components.json`, and rely on `npx shadcn@latest add` directly — the skeleton `CLAUDE.md` already calls this branch out inline.
5. Adjust `.claude/settings.json`'s bash allowlist to the new project's actual package manager and scripts (`npm run build`/`lint` assumes npm — swap for `pnpm`/`yarn`/`bun` as needed).
6. If the project needs a recurring "add a new X" pipeline (a CMS block type, a form field type, etc.), write it as its own skill under `.claude/skills/` following the extension-contract shape described in `CLAUDE.md`'s "domain-specific pipelines" section — not included here since it's inherently project-specific.
7. Run `/init` in Claude Code afterward to have it fill in what it can from the actual codebase, then review.

## Design notes

- **Pointer, not copy.** `SKILL.md` and the reference docs point at the vendor's `get-*-instructions` MCP tools and at each other rather than embedding a frozen snapshot of behavior that can drift out of date.
- **Fetch → gate → install → convert.** Every command fetches metadata first (no side effects), runs the reuse-vs-install comparison gate against what's already in the project, and only then installs — never the reverse. This was a deliberate fix after an earlier version listed the install step before the hierarchy check, which read as "install then reconcile" on a literal pass.
- **Plain CLI fallback is explicit.** Shadcn Studio is a paid layer on top of the official shadcn/ui registry. Every doc that touches installs says outright: if the target is a stock component, skip Studio and use `npx shadcn@latest add` — don't route everything through the paid workflow by default.
