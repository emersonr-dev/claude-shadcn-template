# shadcn/studio MCP server — workflow rules

Reference doc for the `component` skill and the `/cui`, `/rui`, `/iui`, `/ftc` commands. Not invoked directly — read it via those.

This project uses the `shadcn-studio-mcp` server for four workflows, each with a matching Claude Code command:

| Command | Workflow | Instructions tool |
|---|---|---|
| `/cui` | Create UI — new block/page section | `get-create-instructions` |
| `/rui` | Refine UI — edit an existing component/block | `get-refine-instructions` |
| `/iui` | Inspiration UI — design guided by existing blocks, nothing installed | `get-inspire-instructions` |
| `/ftc` | Figma to Code | `get-ftc-instructions` (needs a Figma MCP server too — not included in this template) |

## Why the workflow order matters

Each `get-*-instructions` tool returns the current step-by-step sequence for its workflow, fetched live rather than copied here, since the vendor updates it independently of this repo. The one rule that's consistent across all four and worth stating explicitly: **collect everything before installing anything**. Each workflow separates a collection phase (`get-block-meta-content` / `get-component-meta-content` → `collect_selected_blocks` / `collect_selected_components`) from a single batch install at the end (`get_add_command_for_items` / `get_add_command_for_components`). Installing mid-collection, or one item at a time, breaks the batching the tools are designed around — follow the fetched instructions' step order rather than shortcutting it.

Within one of these workflows, run the fetched steps through to completion rather than pausing after each tool call — that's what the workflow is for. Still stop and ask if the request is genuinely ambiguous (which block, which variant) or if a prerequisite is missing (e.g. `/ftc` without a Figma MCP configured).

## Project conventions on top

The MCP output is generic — always apply this project's own conventions afterward (named exports or whatever this project chose for new `components/ui/*`/`components/providers/*`, `Props` type, `data-slot`, `cn()`, path aliases, no hardcoded colors, component hierarchy). These live in `CLAUDE.md` § "Component conventions" and the `component` skill, not here — this file only covers the MCP tool sequencing.

## Existing component vs. fetched Studio candidate — comparison gate

The component hierarchy rule ("prefer an existing `components/ui/*` component → install a missing shadcn/ui component → extend/compose → never raw Tailwind") tells you *when* to reuse, but not what to do when the workflow's own fetch step (`get-blocks-metadata` / `get-component-meta-content` / `get-inspiration-block-content`) also turns up a Studio candidate that plausibly matches the request. Don't let "an existing component technically satisfies this" end the analysis silently — run this check first:

1. **Fetch before deciding.** Even if an existing project component looks sufficient, still run the workflow's fetch/metadata step so a Studio candidate is on the table for comparison — don't skip the fetch just because reuse seems obvious.
2. **Compare structure, not just outcome.** Look at the underlying primitive, composition pattern, and interaction model of the existing component versus the fetched candidate (e.g. both wrap the same Radix primitive with the same open/close model, vs. one is a single-item disclosure and the other is a multi-panel/animated/nested pattern). Matching visual outcome is not the bar — matching structure is.
3. **Same structure → reuse silently.** If the fetched candidate is essentially the same primitive/pattern reskinned, proceed with the existing component per the hierarchy rule. No need to interrupt the user for this case.
4. **Different structure → stop and ask.** If the candidate is structurally different (different primitive, richer interaction model, or a newer/updated version of a pattern the project's component predates), stop before finalizing the component choice and ask the user via a clarifying question — name both options concretely (what exists in the project vs. what the Studio candidate offers) and the concrete structural difference, so the user can decide whether to keep the existing component or install/adapt the Studio one. Do not silently pick one.
5. This gate runs once per component decision, not per tool call — it's about the final choice of "which component satisfies this request," not a re-litigation of every fetched result.

## Plain shadcn/ui installs — skip the Studio workflow

`shadcn-studio-mcp` is ThemeSelection's Shadcn Studio: a paid Pro Blocks/components/themes marketplace layered on top of the official shadcn/ui registry system (`components.json`'s `@ss-components`/`@ss-themes`/`@ss-blocks` registries, gated by `EMAIL`/`LICENSE_KEY`). The four workflows above exist because Studio's *paid* content — curated blocks, "refine to a newer Studio variant," Figma-to-Pro-block conversion, inspiration browsing — has no official shadcn/ui equivalent. They are not a replacement for the plain shadcn/ui CLI.

When the target is a **stock shadcn/ui primitive with no Pro variant involved** — installing a component that's just in the standard shadcn/ui registry (e.g. `button`, `dialog`, `tabs`), or updating one to its latest official upstream source — skip the Studio MCP tool sequence entirely and use the official CLI directly: `npx shadcn@latest add <name>` (add `--overwrite` to refresh an already-installed component to its current official source). Reach for the Studio workflows only when the request specifically needs Studio's curated blocks/themes, a "refine to newer Studio variant" pass, Figma-to-code, or inspiration browsing — not as the default path for every component touch.
