# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- template-note:start -->
> **Template note:** This is a starting skeleton for a React + shadcn/ui project — Next.js (App Router or Pages Router), Vite, Remix, Astro's React islands, TanStack Start, or any other React framework/setup shadcn/ui supports. Sections marked `[CUSTOMIZE]` need this project's own detail; the shared shadcn/ui conventions live in `.claude/claude-shadcn.md`, imported below. Delete this note once the file is filled in.
<!-- template-note:end -->

## Initial configuration

Environment variables (see `.env`, gitignored):

- `[CUSTOMIZE]` — add this project's own required env vars (API keys, database URLs, auth secrets, etc.). Shadcn Studio's `EMAIL`/`LICENSE_KEY`, if used, are covered in `.claude/claude-shadcn.md`.

## Architecture

`[CUSTOMIZE]` — describe the framework and version this project actually runs (Next.js App Router, Next.js Pages Router, Vite SPA, Remix, TanStack Start, etc.), whether it uses React Server Components at all, state management, data-fetching approach, and any build/runtime behavior that changes how code must be written (e.g. Next.js `cacheComponents` requiring `"use cache"` or Suspense boundaries — framework-specific, delete if not applicable). Add a short subsection per major integration this project has (a CMS, an API layer, auth), the way a real project would.

### `[CUSTOMIZE]` — domain-specific pipelines

If this project has a recurring "add a new X" task (a CMS block type, a form field type, an API resource type, a new page template, etc.), write a dedicated skill for it under `.claude/skills/`, shaped as an extension contract:

- **Where things live** — the exact files involved and what each one is responsible for.
- **The contract** — the ordered list of files to touch, every time, to add a new instance.
- **Checklist** — one line per file/step, plus a reminder to re-check the skill against current source before relying on it (it's a pointer, not a guaranteed-current copy).

Point to canonical source files rather than duplicating their content, so the skill can't silently drift out of date as the code changes.

## shadcn/ui conventions

Shared component conventions and workflow commands (managed by `claude-shadcn-cli`; override them here rather than editing the imported file):

@.claude/claude-shadcn.md

## Other notes

`[CUSTOMIZE]` — theming approach, animation library conventions, testing setup, deployment notes, or anything else future-you or Claude needs to know that isn't derivable from reading the code.
