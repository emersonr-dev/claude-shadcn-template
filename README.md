# claude-shadcn-template

[![CI](https://github.com/emersonr-dev/claude-shadcn-template/actions/workflows/ci.yml/badge.svg)](https://github.com/emersonr-dev/claude-shadcn-template/actions/workflows/ci.yml)

A reusable Claude Code setup for React-based projects built on shadcn/ui. It packages four slash commands that drive the [Shadcn Studio](https://shadcnstudio.com) MCP server through a consistent, hierarchy-respecting workflow, a `component` skill that ties them together, and a `CLAUDE.md` skeleton to start a new project's Claude Code configuration from — so every new repo doesn't reinvent the same rules about when to reuse a component, when to install one, and when to skip the paid workflow entirely.

It works with any React framework shadcn/ui supports — Next.js (App Router or Pages Router), Vite, Remix, TanStack Start, Astro's React islands, or plain React with manual setup.

## Prerequisites

Before using this template in a project:

- **A React project already scaffolded, with `npx shadcn@latest init` already run against it** — this template never ships a static `components.json` to copy over yours, since `init` is what correctly detects this project's actual framework, Tailwind version, and path aliases. See [Installation](#installation) for what to merge in afterward.
- **[Claude Code](https://claude.com/claude-code)** installed and running against the target repo.
- **The `shadcn-studio-mcp` MCP server configured and connected**, if you intend to use `/cui`, `/rui`, `/iui`, or `/ftc`. This is a *separate, paid* product ([Shadcn Studio](https://shadcnstudio.com) by ThemeSelection) layered on top of the free shadcn/ui registry — it needs its own `EMAIL`/`LICENSE_KEY` credentials wired into `components.json`. Each command checks for this connection before doing anything and tells you what's missing if it isn't there.
- **A Figma MCP server**, additionally, only if you intend to use `/ftc` (Figma-to-code). Not included in this template — configure one separately (e.g. `claude mcp add`).
- **No Shadcn Studio license?** You can still use this template — answer "No" to the CLI's license question, or see step 5 under [Manual installation](#manual-installation) for what to remove, and rely on the official `npx shadcn@latest add` CLI directly instead of the four commands.

## What's included

```
CLAUDE.md                                              # user-owned skeleton — fill in [CUSTOMIZE] sections; imports .claude/claude-shadcn.md
components.registries.snippet.json                     # Shadcn Studio registries block — merge into components.json from `init`, not a copy-over
bin/cli.js, src/                                       # claude-shadcn-cli — installs everything below into a project (see Installation)
.claude/
├── claude-shadcn.md                                   # shared shadcn/ui conventions + workflow commands, @-imported by CLAUDE.md
├── settings.json                                      # MCP + bash permission allowlist, PreToolUse hook wiring
├── hooks/
│   └── check-shadcn-studio.sh                         # PreToolUse hook: hard-gates Studio install calls (see "Enforcement" at the end)
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

### With the CLI (recommended)

`claude-shadcn-cli` isn't on the npm registry (`"private": true`). npm installs it straight from this GitHub repo instead, with no tarball or token needed:

```bash
# as a devDependency, pinned to a release range like a registry package
npm i -D "github:emersonr-dev/claude-shadcn-template#semver:^0.1.0"
npx claude-shadcn-cli init

# or a one-off run without adding anything to package.json
npx github:emersonr-dev/claude-shadcn-template init
```

`#semver:^0.1.0` makes npm pick the newest `v*` release tag in that range. To move to a newer release, run the same `npm i -D` command again (`npm update` doesn't re-resolve git dependencies). Leave out `#semver:…` to track the latest commit on `main`.

<details>
<summary>Other ways to install (release tarball, local checkout)</summary>

```bash
# the .tgz attached to a GitHub Release
npm i -D https://github.com/emersonr-dev/claude-shadcn-template/releases/download/v0.1.0/claude-shadcn-cli-0.1.0.tgz
# a local checkout, e.g. while working on the CLI itself
npm i -D file:../claude-shadcn-template
# a tarball you built yourself with `npm pack`
npm i -D /path/to/claude-shadcn-cli-0.1.0.tgz
```

</details>

Nothing runs on install. `init` is an explicit command that asks a few questions and always shows a plan before writing anything:

1. **Checks the stack.** It stops with no `package.json` or no `react` dependency. With React but no `components.json`, it offers to run `npx shadcn@latest init` first. It reads the framework, package manager, `rsc` and global CSS path from the project.
2. **Asks whether you have a Shadcn Studio license.** Without one it skips `/cui`, `/rui`, `/iui`, `/ftc`, the hook, and the `@ss-*` registries.
3. **Shows the plan**: `+` new, `↑` update, `~` merge into existing, `!` conflict, `=` up to date. Then it asks before applying.
4. **Installs without overwriting your work:**
   - Commands, hooks and skills are copied. A file you already have that differs from the template is a **conflict**: yours is kept, and the template's copy goes to `.claude-shadcn-incoming/` with a `MERGE.md` checklist and a ready-made prompt for your AI agent.
   - `CLAUDE.md`: if you have one, it only gains a `@.claude/claude-shadcn.md` import line. If you don't, the skeleton is created.
   - `.claude/settings.json` is merged: permission rules are combined, and only this tool's own hook entries are added or replaced. `npm run` rules are rewritten for your package manager and dropped for scripts you don't have.
   - With a Studio license, the registries are added to `components.json` (existing entries are never changed) and `EMAIL=`/`LICENSE_KEY=` placeholders go into `.env.example`. `.gitignore` gains `.env` and `.claude/settings.local.json`.
5. **Offers Claude Code**, if `claude` is on your PATH, to fill the new `CLAUDE.md`'s `[CUSTOMIZE]` sections and/or merge conflicts. This uses tokens. It runs headless (`claude -p`) with read tools plus `Edit` on only the files involved.

Re-running is safe. `.claude/.claude-shadcn-manifest.json` records what was installed, so files you never touched are updated to the newer template and files you edited become conflicts.

Flags: `--dry-run`, `--yes` (accepts the defaults; no AI step), `--studio` / `--no-studio`, `--no-ai`, `--cwd <dir>`. Run `npx claude-shadcn-cli --help` for details.

### CI and releases

- **CI** (`.github/workflows/ci.yml`) runs on every PR and every push to `main`, on Ubuntu and macOS with Node 20, 22 and 24. It runs `npm test` (unit tests) and `npm run test:smoke`. The smoke test packs the tarball, installs it into a throwaway app, runs `init` twice and checks the hook's decisions. A separate job runs ShellCheck on the shell scripts.
- **Release** (`.github/workflows/release.yml`): bump `version` in `package.json`, merge, then `git tag v<version> && git push origin v<version>`. The workflow checks that the tag matches the version, runs the tests, and creates a GitHub Release with the packed `.tgz` attached. The pushed tag is what `#semver:` installs resolve to. Nothing is published to the npm registry.

### Manual installation

1. Copy `CLAUDE.md` and `.claude/` into the new repo's root (if the repo already has a `CLAUDE.md`, keep it and add a `@.claude/claude-shadcn.md` line to it instead). In `.claude/claude-shadcn.md`, keep only the `<!-- region -->` blocks that apply (`studio` or `no-studio`, and `rsc` only on RSC frameworks).
2. If `components.json` doesn't exist yet in the target repo, run `npx shadcn@latest init` **first** and answer its prompts — it detects this project's actual framework, Tailwind version, and path aliases far more reliably than any static file this template could ship. Never copy a pre-made `components.json` over one `init` would generate; the two can drift (e.g. a stale `tailwind.config.ts` path on a project that's actually on Tailwind v4's CSS-based config, which has none).
3. Merge `components.registries.snippet.json`'s `registries` block into the `components.json` that `init` produced (it's the one thing `init` never adds on its own — Shadcn Studio's registries are a separate paid product layered on top of the official shadcn/ui registry). Set `EMAIL` and `LICENSE_KEY` in `.env` (gitignored) to your Shadcn Studio credentials, matching what that block expects.
4. Fill in every `[CUSTOMIZE]` block in `CLAUDE.md` and `.claude/claude-shadcn.md`: env vars beyond the Studio credentials, this project's actual architecture/framework, its component export convention, where its color tokens live, its component placement rules if they differ from the defaults, and (if applicable) a domain-specific "extension contract" skill for whatever this project's own recurring "add a new X" task is.
5. **No Shadcn Studio license?** Delete `.claude/commands/{cui,rui,iui,ftc}.md`, delete the Studio-specific sections of `.claude/skills/component/SKILL.md` and its `references/` directory, drop the `@ss-*` registries from `components.json`, and rely on `npx shadcn@latest add` directly. `CLAUDE.md` already calls this branch out inline.
6. Adjust `.claude/settings.json`'s bash allowlist to this project's actual package manager and scripts — it assumes `npm run build`/`npm run lint`; swap in `pnpm`/`yarn`/`bun` equivalents as needed.
7. Run `/init` in Claude Code afterward so it fills in what it can infer from the actual codebase, then review its output against what you wrote by hand in step 4.

## Filling in `[CUSTOMIZE]`

`[CUSTOMIZE]` is a plain-text marker in `CLAUDE.md` and `.claude/claude-shadcn.md`. The CLI resolves the ones it can answer from `components.json` (CSS file, RSC bullet, export default); nothing else expands them automatically. It flags a spot where the skeleton has generic guidance describing *what kind* of detail belongs there, standing in for this project's actual fact. "Filling it in" means replacing that guidance with the real answer, then removing the marker so nothing in the finished file still reads as a placeholder. Three variants appear:

- **Plain `[CUSTOMIZE]`** — replace with free text.
- **`[CUSTOMIZE: e.g. ...]`** — same, with a worked example of the likely shape included in the marker itself.
- **`[CUSTOMIZE — condition]`** — conditional: only fill it in if the condition holds; otherwise delete the whole bullet, not just the marker.

Worked examples below use a single mocked project — **Pulse**, a fictional AI-powered customer support SaaS (Next.js App Router, Postgres via Prisma, Stripe billing, OpenAI for ticket triage) — to show how the same set of markers gets filled in for a real-shaped commercial app rather than a simple content site. A non-RSC counterexample is included for the conditional marker's other branch.

**Env vars** (`CLAUDE.md`):
```diff
- `[CUSTOMIZE]` — add this project's own required env vars (API keys, database URLs, auth secrets, etc.).
+ `DATABASE_URL` — Postgres connection string (Prisma).
+ `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — subscription billing and webhook verification.
+ `OPENAI_API_KEY` — powers AI-drafted ticket responses and sentiment tagging.
```

**Architecture** (`CLAUDE.md`):
```diff
- `[CUSTOMIZE]` — describe the framework and version this project actually runs...
+ Next.js 15 (App Router) + React 19 multi-tenant SaaS. Prisma/Postgres for orgs, users, and
+ support tickets. Server Actions handle mutations; TanStack Query handles client-side cache
+ for anything polled (live ticket status, agent presence). Stripe Checkout + Customer Portal
+ handle billing, driven entirely by webhooks — no plan/seat state is trusted from the client.
```

**Domain-specific pipeline** (the `### [CUSTOMIZE]` heading) — replaced with a real section entirely:
```diff
- ### `[CUSTOMIZE]` — domain-specific pipelines
- If this project has a recurring "add a new X" task... [generic shape instructions]
+ ### AI ticket triage pipeline
+ `lib/ai/triage.ts` is the single integration point with OpenAI — classifies incoming tickets
+ (`TicketCategory`) and drafts a suggested reply. Adding a new ticket category or a new
+ AI-derived field on a ticket? See the `ticket-triage` skill for the exact multi-file contract
+ (schema, triage function, and the agent-facing UI that surfaces it).
```

**Component export convention** (`.claude/claude-shadcn.md`; the CLI defaults it to named exports, so override it in `CLAUDE.md`) — this project deliberately picks something other than the template default, which is exactly what the marker is for:
```diff
- `[CUSTOMIZE]` Named exports only (no `export default`) for new `components/ui/*` and
  `components/providers/*` components — or pick a different export convention and state it
  here; whatever is chosen, keep it consistent project-wide and call out any exceptions...
+ Named exports only, project-wide, with no exceptions — including `app/**/page.tsx` and
+ `layout.tsx` route files, which elsewhere might keep a framework's `export default`
+ convention. Pulse enforces this via an ESLint rule so it never silently drifts.
```

**The conditional marker, both directions** (the `"use client"` bullet):
```diff
On Pulse (Next.js App Router — RSC applies) — keep the rule, drop only the marker:
- `[CUSTOMIZE — RSC frameworks only]` If this project uses React Server Components...
+ `"use client"` only where it's load-bearing: the live ticket feed (websocket subscription),
+ the Stripe Checkout button, and the AI reply editor. Ticket list/detail pages themselves stay
+ server components and fetch directly via Prisma.

On a Vite SPA rebuild of the same product (no RSC at all) — delete the entire bullet, since
there's no "use client" directive to have an opinion about. Nothing replaces it.
```

**Colors file** (`.claude/claude-shadcn.md`; the CLI fills it from `components.json`):
```diff
- ...tokens defined in `[CUSTOMIZE: e.g. app/globals.css for Next.js App Router, src/index.css for Vite]`.
+ ...tokens defined in `app/globals.css` — Pulse ships a light/dark pair plus a per-org accent
+ color (`--accent`) that tenants can override from their branding settings.
```

The pattern holds across every marker in the file: read what the placeholder is asking for, write the real fact for *this* project (or delete the bullet, for a conditional marker that doesn't apply), and leave no `[CUSTOMIZE]` text behind in the finished file.

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
- **Fetch → gate → install → convert.** Every command fetches metadata first (no side effects), runs the reuse-vs-install comparison gate against what's already in the project, and only then installs — never the reverse.
- **Plain CLI fallback is explicit.** Shadcn Studio is a paid layer on top of the official shadcn/ui registry. Every doc that touches installs says outright: if the target is a stock component, skip Studio and use `npx shadcn@latest add` — don't route everything through the paid workflow by default.
- **Framework specifics are named, not assumed.** React Server Components conventions (`"use client"`, `rsc: true`) are marked as conditional wherever they appear, so a Vite/CRA/Pages Router project doesn't inherit instructions that don't apply.
- **Prerequisites fail fast.** Every command checks its MCP dependency before doing anything else, so a missing connection or license surfaces immediately with a clear next step instead of a confusing failure mid-workflow.
- **`components.json` is generated, never hand-copied.** `shadcn@latest init` already detects a project's real framework, Tailwind version, and path aliases better than any static file this template could ship — a hand-maintained copy can only drift from that (e.g. asserting a `tailwind.config.ts` path on a project that's actually on Tailwind v4's CSS-based config, which has none). The one thing `init` never adds on its own is the Shadcn Studio `registries` block, since that's a separate paid product's config — so that's the only piece this template ships, as `components.registries.snippet.json`, meant to be merged into whatever `init` produces rather than replacing it.

## Extending this template

If a project needs a recurring "add a new X" pipeline of its own (a CMS block type, a form field type, a new API resource type, etc.), write it as its own skill under `.claude/skills/`, shaped as an extension contract: where the relevant files live, the exact ordered list of files to touch for a new instance, and a checklist — see `CLAUDE.md`'s "domain-specific pipelines" section for the shape. Not included here, since it's inherently specific to each project's own domain.

## Enforcement: prose checks vs. the PreToolUse hook

The commands' "Prerequisite check first" steps are prose the model is expected to read and follow — reliable in practice, but not a guarantee, since nothing stops a sufficiently unusual prompt from skipping past written instructions. `.claude/hooks/check-shadcn-studio.sh`, wired into `.claude/settings.json`'s `PreToolUse` hooks, backs that up with a deterministic check the model cannot talk its way around. It's wired to two entry points:

- **The five Studio MCP tools that actually install something** (`collect_selected_blocks`, `collect_selected_components`, `get_add_command_for_items`, `get_add_command_for_components`, `install-theme`) — gated unconditionally, since calling them is inherently a Studio action. Read-only fetch/metadata calls are never matched, so browsing candidates always works.
- **Any `Bash` call starting with `npx shadcn`** — only gated if the command actually references an `@ss-` registry item (e.g. `npx shadcn add @ss-components/fancy-card`); a plain `npx shadcn add button` is left alone, since that never touches Shadcn Studio. This means a Studio install run directly through Bash goes through the same check as one run through `/cui`/`/rui`/`/iui`.

Both entry points share the same decision logic:

- No `components.json` at all → **deny**. This isn't a shadcn/ui project yet; nothing to install into.
- `components.json` exists but has no `@ss-components` registry → **ask**. Likely just missing the Studio registries merge (the CLI's Studio option, or step 3 of [Manual installation](#manual-installation)), not a structural problem — so it defers to you rather than hard-blocking.
- Registries present (or the Bash command doesn't touch Studio at all) → **no opinion**: the hook exits silently and your normal permission settings (allowlist, Auto Mode, prompts) decide. The hook only ever denies or asks, never auto-approves.

The prose checks stay because they carry judgment a hook can't (e.g. `/rui`'s "is this even a Studio question" branch); the hook exists because "the model complied with the instructions" isn't the same guarantee as "the harness enforced it."

Notes on the hook:

- `ask` shows you a confirmation prompt even in Auto Mode; answering No blocks the call.
- Hook output must be valid JSON. If it isn't, Claude Code ignores the hook, so the script builds its output with `jq`.
- After editing hook settings mid-session, open `/hooks` or restart Claude Code so they load.

## License

[MIT](LICENSE) — use it, fork it, copy any of it into your own projects.

As an additional grant on top of that license: the files `claude-shadcn-cli init` writes into your project — `CLAUDE.md`, `.claude/claude-shadcn.md`, `.claude/settings.json`, and everything under `.claude/commands`, `.claude/hooks`, and `.claude/skills` — are yours to keep, edit, and redistribute with **no attribution requirement**. They're meant to be customized until they no longer resemble this template, so you don't need to carry a copyright notice into your own repo. The attribution clause still applies if you redistribute the CLI itself (`bin/`, `src/`).

Not affiliated with or endorsed by shadcn, Vercel, or ThemeSelection. "shadcn/ui" and "Shadcn Studio" are their respective owners' names, used here only to say what this template works with. shadcn/ui is MIT-licensed; Shadcn Studio is a separate paid product under its own terms — this repo ships no code from either, only configuration and instructions that point at them.
