---
description: Convert a Figma design to code via the Figma MCP server (plus Shadcn Studio blocks when licensed)
argument-hint: [Figma URL with node-id, or a frame selected in Figma]
---

Convert this Figma design to code: $ARGUMENTS

**Prerequisite check first — do not fake or skip it:**

- **Figma MCP (required).** Look for Figma MCP tools: `mcp__figma__*` (the remote server `claude-shadcn-cli` configures in `.mcp.json`), `mcp__figma-desktop__*`, or a Figma plugin's equivalents. If none are available, stop and tell the user to run `/mcp`, select **figma**, and choose **Authenticate** — or, if `.mcp.json` has no Figma entry, `claude mcp add --transport http figma https://mcp.figma.com/mcp`. If the tools exist but return an auth error, give the same `/mcp` → Authenticate instruction.
- **Input.** The remote server needs a Figma URL with a `node-id` (frame selection only works with the desktop server). If `$ARGUMENTS` has no Figma URL and no desktop server is connected, stop and ask for the link.
- **Which path.** If `mcp__shadcn-studio-mcp__*` tools are available and `components.json` has the `@ss-blocks` registry, use **Path A**. Otherwise use **Path B** — say which path you're taking and why in one line.

**Figma tool names.** Figma's current server has no `get_code` tool. Wherever instructions (including Shadcn Studio's fetched ones) say `get_code`, use `get_design_context`. Useful tools: `get_metadata` (sparse layer outline — start here, it's cheap), `get_design_context` (code + content for a node), `get_variable_defs` (colors/spacing/type variables), `get_screenshot` (visual reference), `download_assets` (images, when available).

## Path A — Shadcn Studio blocks (licensed)

1. Call `mcp__shadcn-studio-mcp__get-ftc-instructions` and follow its order: `get_metadata` to find Pro/Free Blocks component instance names → `parse-figma-blocks` → install via `collect_selected_blocks`/`get_add_command_for_items` → replace content from Figma without changing layout → build the page from each block's page-level sample data (never invent placeholder data).
2. Before installing, apply the reuse-vs-install comparison gate from `.claude/skills/component/references/shadcn-studio-workflow.md`: skip blocks this project already has.
3. Frame sections that are **not** Studio block instances: convert them with Path B's steps 2–4 instead of skipping them.
4. Use only the tools listed above for this workflow — not `get-blocks-metadata`, `get-block-meta-content`, `get-component-meta-content`, `get-component-content`, or `get-inspiration-block-content`, which belong to `/cui`/`/rui`/`/iui`.

## Path B — Figma MCP + stock shadcn/ui (no Studio license needed)

1. `get_metadata` on the node to see the section structure; for a large frame, work section by section rather than calling `get_design_context` on the whole page.
2. For each section, call `get_design_context` and `get_screenshot`. Treat the returned markup as a description of the design, not code to paste: map each element onto shadcn/ui components using `.claude/skills/component/references/figma-to-shadcn-mapping.md`, installing missing ones with `npx shadcn@latest add <name>`.
3. Build each section as a component in `components/` (page-specific) following `.claude/claude-shadcn.md` § "Component conventions", then compose them in this project's page/route file.
4. Keep real content from Figma (text, images, links) — never invent placeholder copy.

## Both paths — finish the same way

- **Design tokens.** Call `get_variable_defs` once. Map Figma colors/radii to this project's existing CSS custom properties (the file named in `.claude/claude-shadcn.md`). If a Figma color has no token, add one there rather than hardcoding a hex value — and list any tokens you added.
- **Images.** Never leave `localhost:3845` or Figma asset URLs in the code: the desktop server's links stop working when Figma closes and remote asset links expire. Save images into the project's static folder (e.g. `public/figma/<section>/`) via `download_assets` or by downloading the returned URLs, and reference them from there. This also means no image-domain config changes are needed (e.g. Next.js `images.remotePatterns`).
- **Framework.** Put the page where this project's framework expects routes (Next.js App Router `app/**/page.tsx`, Pages Router `pages/`, Vite/React Router route components, etc.). Add `"use client"` only on RSC frameworks and only where hooks/events need it.
- **Verify.** Compare the result against `get_screenshot` of the original frame and fix visible differences in spacing, hierarchy, and content. Then run the project's lint/build script if it has one.
- **Report.** End with: components installed, files created, tokens added, images saved, and any Figma layers you couldn't map cleanly.
