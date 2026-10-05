#!/usr/bin/env node
import { parseArgs } from "node:util"
import { resolve, join } from "node:path"
import { init } from "../src/init.js"
import { PKG_ROOT, readJson } from "../src/util.js"

const HELP = `Usage: claude-shadcn-cli init [options]

Installs this Claude Code setup (commands, hooks, skills, CLAUDE.md conventions)
into a React + shadcn/ui project. Never overwrites files you changed.

Options:
  --dry-run       Show what would change, write nothing
  --yes, -y       Accept defaults without asking (no AI steps)
  --studio        You have a Shadcn Studio license
  --no-studio     You don't (skips /cui /rui /iui, the hook and the registries)
  --figma         Install /ftc and Figma's remote MCP server
  --no-figma      Skip the Figma setup
  --no-ai         Never offer to run Claude Code
  --cwd <dir>     Project root (default: current directory)
  --help, -h      Show this help
  --version, -v   Show version`

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "dry-run": { type: "boolean" },
    yes: { type: "boolean", short: "y" },
    studio: { type: "boolean" },
    "no-studio": { type: "boolean" },
    figma: { type: "boolean" },
    "no-figma": { type: "boolean" },
    "no-ai": { type: "boolean" },
    cwd: { type: "string" },
    help: { type: "boolean", short: "h" },
    version: { type: "boolean", short: "v" },
  },
})

if (values.version) {
  console.log(readJson(join(PKG_ROOT, "package.json")).version)
} else if (values.help || positionals[0] !== "init") {
  console.log(HELP)
  process.exitCode = values.help ? 0 : 1
} else if ((values.studio && values["no-studio"]) || (values.figma && values["no-figma"])) {
  console.error("Pass either --studio or --no-studio (and --figma or --no-figma), not both.")
  process.exitCode = 1
} else {
  process.exitCode = await init(resolve(values.cwd ?? process.cwd()), {
    dryRun: values["dry-run"],
    yes: values.yes,
    studio: values.studio ? true : values["no-studio"] ? false : undefined,
    figma: values.figma ? true : values["no-figma"] ? false : undefined,
    noAi: values["no-ai"],
  })
}
