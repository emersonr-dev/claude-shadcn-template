---
name: "component"
description: "Generate or modify a React component following project conventions: TypeScript, Tailwind CSS, CVA variants, named exports, and proper client/server boundaries. Always consults the shadcn/ui MCP server for the latest component source before writing or editing code."
disable-model-invocation: false
---

# Component Generator

Generate or modify components using the shadcn/studio MCP server, then apply this project's conventions. **The MCP server must be consulted before writing or editing any component code** (unless this project has no Shadcn Studio license — see "Not every component touch needs the Studio workflow" below).

This file points at the canonical rules rather than copying them — read the sources below, then read current project source (`components/ui/`, `CLAUDE.md`) before editing, since this file is a pointer, not a guaranteed-current copy.

## Canonical sources for this skill

- `.claude/commands/cui.md`, `rui.md`, `iui.md` — one Claude Code command per shadcn/studio MCP workflow. Each calls the matching `mcp__shadcn-studio-mcp__get-*-instructions` tool live (rather than a copy baked into this file) and then applies the conventions below. If the user's request matches one of these workflows but they didn't type the slash command, invoke the same `get-*-instructions` tool directly instead of guessing at steps.
<!-- figma:start -->
- `.claude/commands/ftc.md` — the Figma-to-code command, under the same contract: it calls `get-ftc-instructions` live when this project has a Studio license, and otherwise takes a Figma-only path onto stock shadcn/ui.
<!-- figma:end -->
- `.claude/skills/component/references/shadcn-studio-workflow.md` — why the workflows are structured as "collect everything, then install in one batch," the existing-component-vs-fetched-candidate comparison gate, and which command maps to which MCP instructions tool.
<!-- figma:start -->
- `.claude/skills/component/references/figma-to-shadcn-mapping.md` — Figma element → shadcn/ui component mapping table, used by `/ftc` when converting raw Figma markup.
<!-- figma:end -->
- **shadcn/ui's own tooling, for anything about the CLI, the registry or the primitive library.** `npx shadcn@latest info --json` reports this project's framework, base library, aliases and installed components — cheaper and more reliable than inferring any of it. shadcn also ships an official agent skill (`pnpm dlx skills add shadcn/ui`) covering the CLI, theming and registry authoring, plus the per-component base migration (`migrate accordion to base-ui`); prefer it over guessing at CLI behavior, and over this file for a migration.
- `.claude/claude-shadcn.md` § "Component conventions" — the enforced conventions (named exports or whatever this project chose, `Props` type, `data-slot`, `cn()`, path aliases, no hardcoded colors, placement rules). Apply these to every component this skill produces; don't restate them here, they change independently of this skill.

## Which workflow to use

| Situation | Command | MCP instructions tool |
|---|---|---|
| Building a new block/page section | `/cui` | `get-create-instructions` |
| Editing/updating an existing component or block | `/rui` | `get-refine-instructions` |
| Want design inspiration, nothing installed | `/iui` | `get-inspire-instructions` |
<!-- figma:start -->
| Converting a Figma design to code | `/ftc` | `get-ftc-instructions` with a Studio license; Figma MCP + stock shadcn/ui without one (see `ftc.md`) |
<!-- figma:end -->

Don't hand-roll a distilled version of the tool sequence here — call the relevant `get-*-instructions` tool and follow what it returns; it's the vendor's source of truth and can change independently of this repo.

**Not every component touch needs the Studio workflow.** The commands above wrap ThemeSelection's paid Shadcn Studio marketplace (curated Pro blocks/themes), not the plain shadcn/ui registry. If the request is just installing or updating a stock shadcn/ui primitive with no Pro variant involved, skip straight to `npx shadcn@latest add <name>` (`--overwrite` to refresh to the latest official source) instead of running a Studio workflow for it — see `references/shadcn-studio-workflow.md` § "Plain shadcn/ui installs — skip the Studio workflow". If this project has no Shadcn Studio license at all, delete those commands, this skill's Studio-specific sections, and `components.json`'s `@ss-*` registries, and treat `npx shadcn@latest add` as the only install path.

## Reference templates

Use only when the MCP server returns no suitable match, or as a structural guide while adapting fetched source — these aren't in the fetched output itself. The `"use client"` directive below applies only on frameworks with React Server Components (Next.js App Router, etc.) — drop that line entirely on a plain client-rendered React app (Vite, CRA, Next.js Pages Router, Remix without RSC).

### Simple component (no variants)

```tsx
import { cn } from "cn"

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
import { cn } from "cn"

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

### Primitive wrapper

shadcn/ui wraps one of three low-level primitive libraries, picked by `components.json`'s `style` at `init` time and fixed after that: `radix-*` (Radix UI), `base-*` ([Base UI](https://base-ui.com) — the default for new projects since July 2026) or `aria-*` (React Aria). Import path, props types and part names all differ between them, so **the ground truth is a sibling file**: open a component the CLI installed into `components/ui/` and match what it does. The template below is for this project's base.

Two things hold on every base: components are plain functions — `ref` is an ordinary prop, so no `React.forwardRef`, no `React.ElementRef`, no `displayName` (upstream dropped all three with the React 19 / Tailwind v4 sources) — and every part carries its own `data-slot`.

<!-- primitive-radix:start -->
#### Radix UI (`radix-*` style)

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { cn } from "cn"

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("/* base classes */", className)}
      {...props}
    />
  )
}

export { DialogOverlay }
```

- Import from the unified `radix-ui` package, not the per-package `@radix-ui/react-*` modules the older sources used (`npx shadcn@latest migrate radix` moves an existing project across).
- Props type: `React.ComponentProps<typeof DialogPrimitive.Part>`.
- Compose with `asChild`.
<!-- primitive-radix:end -->
<!-- primitive-base:start -->
#### Base UI (`base-*` style)

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn("/* base classes */", className)}
      {...props}
    />
  )
}

export { DialogOverlay }
```

- Import per primitive: `@base-ui/react/<primitive>`.
- Props types are namespaced on the part itself — `DialogPrimitive.Backdrop.Props`, not `React.ComponentProps<…>`.
- Compose with the `render` prop; Base UI has no `asChild`.
- Part names are not Radix's: `Backdrop` (Radix `Overlay`), `Popup` (Radix `Content`), plus `Positioner` on floating components. Don't assume a Radix part exists here.
<!-- primitive-base:end -->
<!-- primitive-aria:start -->
#### React Aria (`aria-*` style)

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import * as React from "react"
import {
  ModalOverlay as ModalOverlayPrimitive,
  type ModalOverlayProps,
} from "react-aria-components"
import { cn } from "cn"

function DialogOverlay({
  className,
  ...props
}: Omit<ModalOverlayProps, "className"> & { className?: string }) {
  return (
    <ModalOverlayPrimitive
      data-slot="dialog-overlay"
      className={cn("/* base classes */", className)}
      {...props}
    />
  )
}

export { DialogOverlay }
```

- Named components and their own `…Props` types, all from the single `react-aria-components` package.
- Upstream types `className` (and some `children`) as a function of render state, which is why a wrapper re-types it as a plain string before handing it to `cn()`.
- Compose with render props and `slot` wiring (`<Button slot="close">`) — there's no `asChild` or `render` prop.
- The exported surface differs from the other bases (the React Aria dialog ships no `DialogContent`/`DialogPortal`), so read `components/ui/` before composing parts by name.
<!-- primitive-aria:end -->

If this project ever changes base (shadcn's own skill does it per component: `migrate accordion to base-ui`), re-run this template's installer so this file is regenerated for the new one.

### Client component (hooks / interactivity)

```tsx
"use client" // RSC frameworks only — omit on a plain client-rendered React app

import { useState } from "react"
import { cn } from "cn"

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
<!-- figma:start -->
- [ ] Component hierarchy followed (existing → install → extend → never pure Tailwind — see `references/figma-to-shadcn-mapping.md` for the Figma-conversion case)
<!-- figma:end -->
<!-- no-figma:start -->
- [ ] Component hierarchy followed (existing → install → extend → never pure Tailwind)
<!-- no-figma:end -->
- [ ] Any hand-written primitive wrapper matches this project's base library — right import path, part names and props types — and no second primitive library was introduced
- [ ] Conventions from `.claude/claude-shadcn.md` § "Component conventions" applied (exports, `Props` type, `data-slot`, `cn()`, path aliases, no hardcoded colors, placement)
- [ ] Re-checked against current `CLAUDE.md` / `references/*` before relying on this file — it's a pointer, not a guaranteed-current copy
