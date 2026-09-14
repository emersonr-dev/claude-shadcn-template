# Figma → shadcn/ui conversion mapping

Reference for the `/ftc` (Figma-to-Code) workflow (see `.claude/commands/ftc.md` and the `component` skill). The component-hierarchy rule itself (existing `components/ui/*` → install → extend → never raw Tailwind) lives in `CLAUDE.md` § "Component conventions" — this file only adds what that rule doesn't cover: how to map Figma's raw output onto shadcn/ui components.

## Why this file exists

Figma MCP tools return plain Tailwind markup, not shadcn/ui components. That output must be converted before it lands in this repo — never used as-is, even though it "looks fine."

**Wrong** (raw Figma output):
```tsx
<div className="bg-white rounded-lg p-6 shadow-md">
  <button className="bg-blue-500 text-white px-4 py-2 rounded">Click me</button>
</div>
```

**Right** (converted):
```tsx
<Card>
  <CardContent className="p-6">
    <Button>Click me</Button>
  </CardContent>
</Card>
```

Conversion process: identify what each element represents (card, button, badge, tabs, ...), map it using the table below, extract only the real content (text/images/data/layout), and rebuild with shadcn/ui components. Use Tailwind only for spacing/layout/positioning that shadcn/ui doesn't itself control.

## Element → component mapping

| Figma output | shadcn/ui component |
|---|---|
| Card-like container (bg + rounded + shadow) | `Card`, `CardHeader`, `CardContent`, `CardFooter` |
| Button | `Button` (pick a variant: default, destructive, outline, secondary, ghost, link) |
| Badge / pill | `Badge` |
| Tabs | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| Modal / popup | `Dialog`, `Sheet`, or `Popover` depending on interaction |
| Dropdown | `DropdownMenu` |
| Form input | `Input`, `Textarea`, `Select` |
| Table | `Table` with proper semantic structure |
| Avatar | `Avatar`, `AvatarImage`, `AvatarFallback` |
| Alert / banner | `Alert`, `AlertDescription` |
| Loading placeholder | `Skeleton` |
| Progress indicator | `Progress` |
| Searchable list | `Command` |
| Site/page navigation | `NavigationMenu` |

If nothing in `components/ui/` fits, install the missing shadcn/ui component (`npx shadcn@latest add <name>`) before writing custom markup — see the component hierarchy rule in `CLAUDE.md`.
