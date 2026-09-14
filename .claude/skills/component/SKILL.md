---
name: "component"
description: "Generate or modify a React component following project conventions: TypeScript, Tailwind CSS, CVA variants, named exports, and proper client/server boundaries. Always consults the shadcn/ui MCP server for the latest component source before writing or editing code."
disable-model-invocation: false
---

# Component Generator

Generate or modify components using the shadcn/studio MCP server, then apply this project's conventions. **The MCP server must be consulted before writing or editing any component code** (unless this project has no Shadcn Studio license — see "Not every component touch needs the Studio workflow" below).

This file points at the canonical rules rather than copying them — read the sources below, then read current project source (`components/ui/`, `CLAUDE.md`) before editing, since this file is a pointer, not a guaranteed-current copy.

## Canonical sources for this skill

- `.claude/commands/cui.md`, `rui.md`, `iui.md`, `ftc.md` — one Claude Code command per shadcn/studio MCP workflow. Each calls the matching `mcp__shadcn-studio-mcp__get-*-instructions` tool live (rather than a copy baked into this file) and then applies the conventions below. If the user's request matches one of these workflows but they didn't type the slash command, invoke the same `get-*-instructions` tool directly instead of guessing at steps.
- `.claude/skills/component/references/shadcn-studio-workflow.md` — why the workflows are structured as "collect everything, then install in one batch," the existing-component-vs-fetched-candidate comparison gate, and which command maps to which MCP instructions tool.
- `.claude/skills/component/references/figma-to-shadcn-mapping.md` — Figma element → shadcn/ui component mapping table, used by `/ftc` when converting raw Figma markup.
- `CLAUDE.md` § "Component conventions" — the enforced conventions (named exports or whatever this project chose, `Props` type, `data-slot`, `cn()`, path aliases, no hardcoded colors, placement rules). Apply these to every component this skill produces; don't restate them here, they change independently of this skill.

## Which workflow to use

| Situation | Command | MCP instructions tool |
|---|---|---|
| Building a new block/page section | `/cui` | `get-create-instructions` |
| Editing/updating an existing component or block | `/rui` | `get-refine-instructions` |
| Want design inspiration, nothing installed | `/iui` | `get-inspire-instructions` |
| Converting a Figma design to code | `/ftc` | `get-ftc-instructions` (needs a Figma MCP server configured — not included in this template) |

Don't hand-roll a distilled version of the tool sequence here — call the relevant `get-*-instructions` tool and follow what it returns; it's the vendor's source of truth and can change independently of this repo.

**Not every component touch needs the Studio workflow.** These four commands wrap ThemeSelection's paid Shadcn Studio marketplace (curated Pro blocks/themes), not the plain shadcn/ui registry. If the request is just installing or updating a stock shadcn/ui primitive with no Pro variant involved, skip straight to `npx shadcn@latest add <name>` (`--overwrite` to refresh to the latest official source) instead of running a Studio workflow for it — see `references/shadcn-studio-workflow.md` § "Plain shadcn/ui installs — skip the Studio workflow". If this project has no Shadcn Studio license at all, delete the four commands, this skill's Studio-specific sections, and `components.json`'s `@ss-*` registries, and treat `npx shadcn@latest add` as the only install path.

## Reference templates

Use only when the MCP server returns no suitable match, or as a structural guide while adapting fetched source — these aren't in the fetched output itself. The `"use client"` directive below applies only on frameworks with React Server Components (Next.js App Router, etc.) — drop that line entirely on a plain client-rendered React app (Vite, CRA, Next.js Pages Router, Remix without RSC).

### Simple component (no variants)

```tsx
import { cn } from "@/lib/utils"

interface MyComponentProps extends React.ComponentPropsWithoutRef<"div"> {
  // add custom props here
}

function MyComponent({ className, children, ...props }: MyComponentProps) {
  return (
    <div
      data-slot="my-component"
      className={cn("/* base Tailwind classes */", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { MyComponent }
export type { MyComponentProps }
```

### CVA variants

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const myComponentVariants = cva(
  "/* base classes */",
  {
    variants: {
      variant: {
        default: "/* default */",
        outline: "/* outline */",
        ghost:   "/* ghost */",
      },
      size: {
        sm: "/* small */",
        default: "/* default */",
        lg: "/* large */",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

interface MyComponentProps
  extends React.ComponentPropsWithoutRef<"div">,
    VariantProps<typeof myComponentVariants> {}

function MyComponent({ className, variant, size, ...props }: MyComponentProps) {
  return (
    <div
      data-slot="my-component"
      className={cn(myComponentVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { MyComponent, myComponentVariants }
export type { MyComponentProps }
```

### Radix UI primitive wrapper

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import * as React from "react"
import * as SomePrimitive from "@radix-ui/react-some-primitive"
import { cn } from "@/lib/utils"

const MyComponent = React.forwardRef<
  React.ElementRef<typeof SomePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SomePrimitive.Root>
>(({ className, ...props }, ref) => (
  <SomePrimitive.Root
    ref={ref}
    data-slot="my-component"
    className={cn("/* base classes */", className)}
    {...props}
  />
))
MyComponent.displayName = "MyComponent"

export { MyComponent }
```

### Client component (hooks / interactivity)

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import { useState } from "react"
import { cn } from "@/lib/utils"

interface MyComponentProps {
  defaultValue?: string
  className?: string
}

function MyComponent({ defaultValue = "", className }: MyComponentProps) {
  const [value, setValue] = useState(defaultValue)

  return (
    <div data-slot="my-component" className={cn("/* base classes */", className)}>
      {/* JSX */}
    </div>
  )
}

export { MyComponent }
export type { MyComponentProps }
```

## Checklist before finalizing

- [ ] MCP workflow ran to completion (no steps skipped, no premature installs) — or the plain `npx shadcn@latest add` path was used instead, when appropriate
- [ ] Component hierarchy followed (existing → install → extend → never pure Tailwind — see `references/figma-to-shadcn-mapping.md` for the Figma-conversion case)
- [ ] Conventions from `CLAUDE.md` § "Component conventions" applied (exports, `Props` type, `data-slot`, `cn()`, path aliases, no hardcoded colors, placement)
- [ ] Re-checked against current `CLAUDE.md` / `references/*` before relying on this file — it's a pointer, not a guaranteed-current copy
