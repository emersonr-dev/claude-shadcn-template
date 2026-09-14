---
description: Convert a Figma design to code via the shadcn/studio MCP server
argument-hint: [Figma frame selected, or a Figma URL with node-id]
---

Convert the Figma design to code using the shadcn/studio MCP "Figma to Code" workflow: $ARGUMENTS

**Prerequisite check first**: this workflow needs both the `shadcn-studio-mcp` MCP server (with a valid Shadcn Studio license — `EMAIL`/`LICENSE_KEY`) and a separate Figma MCP server (for `get_metadata`/`get_code`). Check what's currently configured for this project. If `mcp__shadcn-studio-mcp__*` tools aren't available, stop and tell the user to configure that MCP server or license first — this workflow has no plain-CLI fallback, since it depends on Studio's Figma-to-Pro-block conversion. If Figma MCP tools aren't available, stop and tell the user to configure one (e.g. `claude mcp add`) before this command can run. Do not attempt to fake or skip either check.

Once both MCP servers are available:

1. Call `mcp__shadcn-studio-mcp__get-ftc-instructions` and follow it exactly. It defines the required tool order — extract the Pro/Free Blocks component instance name from Figma, convert it via `parse-figma-blocks`, install via `collect_selected_blocks`/`get_add_command_for_items`, replace content (text/images/logo) from Figma without changing layout, then build the page/route by copying data out of each block's page-level file (`page.tsx` for Next.js App Router, or this project's equivalent route/page component) — never invent placeholder data.
2. Use only the tools the fetched instructions list for this workflow (Figma MCP's `get_metadata`/`get_code`, plus `parse-figma-blocks`, `collect_selected_blocks`, `get_add_command_for_items`) — not `get-blocks-metadata`, `get-block-meta-content`, `get-component-meta-content`, `get-component-content`, or `get-inspiration-block-content`, which belong to `/cui`/`/rui`/`/iui`.
3. Layer this project's conventions on top, per `CLAUDE.md` § "Component conventions" and the `component` skill: named exports (or this project's chosen convention) for new `components/ui/*`/`components/providers/*` files, an exported `Props` type, `data-slot="component-name"`, `cn()` for class merging, path aliases, no hardcoded colors, and (on RSC frameworks) `"use client"` only where actually needed. Also confirm this project's image-loading config — if it has one, e.g. Next.js's `next.config` remote image domains — allows any external image domains the Figma plugin pulled in (e.g. `localhost:3845`); skip this check on frameworks with no such allowlist.
4. Confirm the component hierarchy rule holds: prefer an existing `components/ui/*` component → install a missing shadcn/ui component → extend/compose → never raw Tailwind when a shadcn/ui equivalent exists — this is the rule Figma-sourced code violates by default. See `.claude/skills/component/references/figma-to-shadcn-mapping.md` for the element → shadcn/ui component mapping when converting raw Figma markup.
