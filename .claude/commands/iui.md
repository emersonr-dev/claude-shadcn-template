---
description: Design a new component/section inspired by shadcn/studio blocks, not installed from them
argument-hint: [what to build, e.g. "a hero section for a fintech landing page"]
---

Design the following for inspiration (not direct install), using the shadcn/studio MCP "Inspiration UI" workflow: $ARGUMENTS

**Prerequisite check first**: this workflow needs the `shadcn-studio-mcp` MCP server connected, with a valid Shadcn Studio license (`EMAIL`/`LICENSE_KEY`). If `mcp__shadcn-studio-mcp__*` tools aren't available, stop and tell the user to configure the MCP server first (see this repo's README) — this workflow has no plain-CLI equivalent since its whole point is browsing Studio's catalog for inspiration.

Once `shadcn-studio-mcp` is available:

1. Call `mcp__shadcn-studio-mcp__get-inspire-instructions` and follow it exactly. It defines the required tool order — `get-blocks-metadata` to find candidates, then `get-inspiration-block-content` to fetch the block(s) for analysis.
2. Before synthesizing anything, confirm the component hierarchy rule holds: prefer an existing `components/ui/*` component → extend/compose shadcn/ui primitives → never raw Tailwind when a shadcn/ui equivalent exists. Run the comparison gate in `.claude/skills/component/references/shadcn-studio-workflow.md` § "Existing component vs. fetched Studio candidate" against the fetched blocks — if an existing project component already matches the pattern structurally, base the design on extending that component rather than inventing a new structure; if the fetched blocks reveal a materially different/richer pattern than what exists, stop and ask the user which direction to take before designing.
3. This workflow never installs anything from the fetched blocks — do not call `collect_selected_blocks`, `collect_selected_components`, or any `get_add_command_for_*` tool here. Analyze layout/component/design patterns across the fetched blocks and synthesize a new design tailored to the request; don't replicate a single source block.
4. Write the new component using this project's conventions, per `CLAUDE.md` § "Component conventions" and the `component` skill: named exports for new `components/ui/*`/`components/providers/*` files, an exported `Props` type, `data-slot="component-name"`, `cn()` for class merging, path aliases, no hardcoded colors, and `"use client"` only where actually needed.
