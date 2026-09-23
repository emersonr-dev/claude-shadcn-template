# claude-shadcn-template

A reusable Claude Code setup for React-based projects built on shadcn/ui. It packages four slash commands that drive the [Shadcn Studio](https://shadcnstudio.com) MCP server through a consistent, hierarchy-respecting workflow, a `component` skill that ties them together, and a `CLAUDE.md` skeleton to start a new project's Claude Code configuration from — so every new repo doesn't reinvent the same rules about when to reuse a component, when to install one, and when to skip the paid workflow entirely.

It works with any React framework shadcn/ui supports — Next.js (App Router or Pages Router), Vite, Remix, TanStack Start, Astro's React islands, or plain React with manual setup.

Extracted from a working project's Claude Code setup after several rounds of fixing real gaps: installing a component before checking whether one already covered the request, no fallback to the plain shadcn/ui CLI for stock components, workflow docs split across `.github/instructions/*` and `.claude/`, and Next.js-only assumptions baked in as if they held everywhere. Each of those fixes is called out in [Design notes](#design-notes).

## Prerequisites

Before using this template in a project:

- **A React project already scaffolded, with `npx shadcn@latest init` already run against it** — this template never ships a static `components.json` to copy over yours, since `init` is what correctly detects this project's actual framework, Tailwind version, and path aliases. See [Installation](#installation) for what to merge in afterward.
- **[Claude Code](https://claude.com/claude-code)** installed and running against the target repo.
- **The `shadcn-studio-mcp` MCP server configured and connected**, if you intend to use `/cui`, `/rui`, `/iui`, or `/ftc`. This is a *separate, paid* product ([Shadcn Studio](https://shadcnstudio.com) by ThemeSelection) layered on top of the free shadcn/ui registry — it needs its own `EMAIL`/`LICENSE_KEY` credentials wired into `components.json`. Each command checks for this connection before doing anything and tells you what's missing if it isn't there.
- **A Figma MCP server**, additionally, only if you intend to use `/ftc` (Figma-to-code). Not included in this template — configure one separately (e.g. `claude mcp add`).
- **No Shadcn Studio license?** You can still use this template — see step 5 under [Installation](#installation) for what to remove, and rely on the official `npx shadcn@latest add` CLI directly instead of the four commands.

## What's included

```
CLAUDE.md                                              # skeleton — fill in [CUSTOMIZE] sections
components.registries.snippet.json                     # Shadcn Studio registries block — merge into components.json from `init`, not a copy-over
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

## Installation

1. Copy `CLAUDE.md` and `.claude/` into the new repo's root.
2. If `components.json` doesn't exist yet in the target repo, run `npx shadcn@latest init` **first** and answer its prompts — it detects this project's actual framework, Tailwind version, and path aliases far more reliably than any static file this template could ship. Never copy a pre-made `components.json` over one `init` would generate; the two can drift (e.g. a stale `tailwind.config.ts` path on a project that's actually on Tailwind v4's CSS-based config, which has none).
3. Merge `components.registries.snippet.json`'s `registries` block into the `components.json` that `init` produced (it's the one thing `init` never adds on its own — Shadcn Studio's registries are a separate paid product layered on top of the official shadcn/ui registry). Set `EMAIL` and `LICENSE_KEY` in `.env` (gitignored) to your Shadcn Studio credentials, matching what that block expects.
4. Fill in every `[CUSTOMIZE]` block in `CLAUDE.md`: env vars beyond the Studio credentials, this project's actual architecture/framework, its component export convention, where its color tokens live, its component placement rules if they differ from the defaults, and (if applicable) a domain-specific "extension contract" skill for whatever this project's own recurring "add a new X" task is.
5. **No Shadcn Studio license?** Delete `.claude/commands/{cui,rui,iui,ftc}.md`, delete the Studio-specific sections of `.claude/skills/component/SKILL.md` and its `references/` directory, drop the `@ss-*` registries from `components.json`, and rely on `npx shadcn@latest add` directly. `CLAUDE.md` already calls this branch out inline.
6. Adjust `.claude/settings.json`'s bash allowlist to this project's actual package manager and scripts — it assumes `npm run build`/`npm run lint`; swap in `pnpm`/`yarn`/`bun` equivalents as needed.
7. Run `/init` in Claude Code afterward so it fills in what it can infer from the actual codebase, then review its output against what you wrote by hand in step 4.

## Filling in `[CUSTOMIZE]`

`[CUSTOMIZE]` is a plain-text marker in `CLAUDE.md` — nothing reads or expands it automatically. It flags a spot where the skeleton has generic guidance describing *what kind* of detail belongs there, standing in for this project's actual fact. "Filling it in" means replacing that guidance with the real answer, then removing the marker so nothing in the finished file still reads as a placeholder. Three variants appear:

- **Plain `[CUSTOMIZE]`** — replace with free text.
- **`[CUSTOMIZE: e.g. ...]`** — same, with a worked example of the likely shape included in the marker itself.
- **`[CUSTOMIZE — condition]`** — conditional: only fill it in if the condition holds; otherwise delete the whole bullet, not just the marker.

Worked examples below, using the project this template was extracted from (`dev-portfolio`: Next.js App Router, RSC) — plus one non-RSC case to show the conditional marker's other branch.

**Env vars** (line 12):
```diff
- `[CUSTOMIZE]` — add this project's own required env vars (API keys, database URLs, auth secrets, etc.).
+ `NOTION_CLIENT_ID`, `NOTION_DATABASE_ID` — required for the blog to fetch content from Notion.
+ `APP_ENV` — environment flag read by the deploy config.
```

**Architecture** (line 16):
```diff
- `[CUSTOMIZE]` — describe the framework and version this project actually runs...
+ Next.js 16 (App Router) + React 19 personal portfolio and Notion-backed blog. Tailwind CSS v4
+ uses CSS-based config (`app/globals.css` `@theme`, no `tailwind.config.*`). `cacheComponents`
+ is enabled (`next.config.ts`) — new server-side data-fetching functions must use `"use cache"`
+ or be wrapped in Suspense, or the build breaks.
```

**Domain-specific pipeline** (the `### [CUSTOMIZE]` heading) — replaced with a real section entirely:
```diff
- ### `[CUSTOMIZE]` — domain-specific pipelines
- If this project has a recurring "add a new X" task... [generic shape instructions]
+ ### Notion content pipeline
+ `lib/posts.ts` is the single integration point with the Notion API (`@notionhq/client`).
+ Adding a new Notion block type, or touching how posts are fetched/cached/rendered?
+ See the `notion-block-type` skill.
```

**The conditional marker, both directions** (the `"use client"` bullet):
```diff
On a Next.js App Router project (RSC applies) — keep the rule, drop only the marker:
- `[CUSTOMIZE — RSC frameworks only]` If this project uses React Server Components...
+ `"use client"` only when the component needs hooks, event handlers, or browser APIs —
+ most blog/content rendering is server components.

On a Vite SPA (no RSC at all) — delete the entire bullet, since there's no
"use client" directive to have an opinion about. Nothing replaces it.
```

The pattern holds across every marker in the file: read what the placeholder is asking for, write the real fact (or delete the bullet, for a conditional marker that doesn't apply), and leave no `[CUSTOMIZE]` text behind in the finished file.

## Usage

Once installed, four slash commands are available in Claude Code:

| Command | When to use it | What it does |
|---|---|---|
| `/cui <description>` | Building a new block or page section | Fetches matching Shadcn Studio blocks, compares them against what already exists in the project, and installs only if nothing already covers the request. |
| `/rui <change>` | Editing or updating an existing component/block | Checks first whether the fix is really just "update a stock component" (→ plain CLI) or genuinely needs a newer/Pro Studio variant, then refines accordingly. |
| `/iui <description>` | Wanting design inspiration without installing anything | Browses Studio's blocks for patterns and synthesizes a new design from them — never installs. |
| `/ftc <Figma frame/URL>` | Converting a Figma design to code | Extracts the design via a Figma MCP server, converts it through Studio's block system, and maps raw output onto shadcn/ui components. |

Each command opens with a prerequisite check: if `shadcn-studio-mcp` (or, for `/ftc`, the Figma MCP server) isn't connected, it stops immediately and tells you what to configure, rather than failing partway through with a confusing error. You never need to invoke the underlying MCP tools directly — typing the slash command is enough.

For anything that's just a stock shadcn/ui component with no Pro/Studio variant involved, skip these commands and run `npx shadcn@latest add <name>` (or `--overwrite` to refresh one already installed) directly — the `component` skill and `CLAUDE.md` both call this out as the preferred path for that case.

## Framework compatibility

shadcn/ui itself supports multiple React frameworks, and so does everything in this template — the commands and skill only ever call MCP tools or `npx shadcn@latest add`, neither of which is Next.js-specific. `components.json` itself is never a per-framework concern here: it always comes from that project's own `npx shadcn@latest init` run, which already knows how to detect Next.js App Router vs. Pages Router vs. Vite vs. anything else it supports — this template only ever adds the registries snippet on top, regardless of framework. The remaining places that genuinely differ per framework are called out explicitly rather than papered over:

| Concern | Next.js App Router (or other RSC framework) | Vite / CRA / Pages Router / non-RSC |
|---|---|---|
| `"use client"` directive | keep — required wherever a component uses hooks/events/browser APIs | delete entirely — this directive doesn't exist outside RSC |
| Image/asset allowlisting (`/ftc` only) | check `next.config`'s remote image domains | skip — most non-Next setups have no such allowlist |
| Page/route file (`/ftc` only) | `page.tsx` | this project's equivalent route/page component |

If a future React framework isn't Next.js or a plain Vite-style SPA, its own `shadcn@latest init` support handles the framework-specific `components.json` detection — nothing in this template needs to change, since the commands and skill don't reference a framework by name anywhere except the table above.

## Design notes

- **Pointer, not copy.** `SKILL.md` and the reference docs point at the vendor's `get-*-instructions` MCP tools and at each other rather than embedding a frozen snapshot of behavior that can drift out of date.
- **Fetch → gate → install → convert.** Every command fetches metadata first (no side effects), runs the reuse-vs-install comparison gate against what's already in the project, and only then installs — never the reverse. This was a deliberate fix after an earlier version listed the install step before the hierarchy check, which read as "install then reconcile" on a literal pass.
- **Plain CLI fallback is explicit.** Shadcn Studio is a paid layer on top of the official shadcn/ui registry. Every doc that touches installs says outright: if the target is a stock component, skip Studio and use `npx shadcn@latest add` — don't route everything through the paid workflow by default.
- **Framework specifics are named, not assumed.** React Server Components conventions (`"use client"`, `rsc: true`) used to be written as if every consumer would be a Next.js App Router project. They're now called out as conditional wherever they appear, so a Vite/CRA/Pages-Router project doesn't inherit dead instructions.
- **Prerequisites fail fast.** Every command checks its MCP dependency before doing anything else, so a missing connection or license surfaces immediately with a clear next step instead of a confusing failure mid-workflow.
- **`components.json` is generated, never hand-copied.** This template used to ship two full static `components.json.*.example` files to copy over the target project's own — including a hardcoded `"tailwind": { "config": "tailwind.config.ts" }` that's simply wrong on a Tailwind v4 project (official guidance: leave that field `""` when there's no config file to point at). The only part of `components.json` this template actually needs to add is the Shadcn Studio `registries` block, which `shadcn@latest init` never generates on its own — so that's the only piece shipped now, as `components.registries.snippet.json`, meant to be merged into whatever `init` produces rather than replacing it.

## Extending this template

If a project needs a recurring "add a new X" pipeline of its own (a CMS block type, a form field type, a new API resource type, etc.), write it as its own skill under `.claude/skills/`, shaped as an extension contract: where the relevant files live, the exact ordered list of files to touch for a new instance, and a checklist — see `CLAUDE.md`'s "domain-specific pipelines" section for the shape. Not included here, since it's inherently specific to each project's own domain.
