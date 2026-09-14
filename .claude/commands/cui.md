---
description: Create a new shadcn/ui block or page section via the shadcn/studio MCP server
argument-hint: [what to build, e.g. "a pricing section with 3 tiers"]
---

Build the following with the shadcn/studio MCP "Create UI" workflow: $ARGUMENTS

1. Call `mcp__shadcn-studio-mcp__get-create-instructions` and follow its collection phase — identify every block needed and fetch metadata for each (`get-blocks-metadata` → `get-block-meta-content`) — but do not install anything yet.
2. Before collecting/installing any fetched candidate, confirm the component hierarchy rule holds: prefer an existing `components/ui/*` component → install a missing shadcn/ui component → extend/compose shadcn/ui primitives → never raw Tailwind `<div>`/`<button>` when a shadcn/ui equivalent exists. Run the comparison gate in `.claude/skills/component/references/shadcn-studio-workflow.md` § "Existing component vs. fetched Studio candidate" against the metadata just fetched:
   - Fetched candidate matches an existing project component's structure → reuse/extend that component; skip the install steps below.
   - Fetched candidate is structurally different from an existing component that could otherwise satisfy the request → stop and ask the user which to use before proceeding.
   - No existing component covers the request → proceed to install the fetched candidate.
3. If installing: finish the workflow per the fetched instructions — collect the selected block(s) (`collect_selected_blocks`), generate one batch install command (`get_add_command_for_items`), and run it. Do not stop for confirmation mid-collection; only pause for the decision in step 2 or a genuinely ambiguous choice (which block/variant).
4. After installation, the fetched instructions also require customizing content (text/images) to match the request — don't skip that step.
5. Layer this project's conventions on top of whatever the workflow produced (installed or hand-composed), per `CLAUDE.md` § "Component conventions" and the `component` skill: named exports for new `components/ui/*`/`components/providers/*` files, an exported `Props` type, `data-slot="component-name"` on the root element, `cn()` for class merging, path aliases instead of relative imports, no hardcoded colors, and `"use client"` only where hooks/events/browser APIs are actually needed.
