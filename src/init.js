import { spawnSync } from "node:child_process"
import * as p from "@clack/prompts"
import { detectProject } from "./detect.js"
import { buildPlan, readManifest } from "./plan.js"
import { applyPlan } from "./apply.js"
import { hasClaudeCli, runClaude, fillClaudeMdPrompt, mergeConflictsPrompt } from "./agent.js"
import { INCOMING_DIR } from "./util.js"

const SYMBOLS = { create: "+", update: "↑", merge: "~", conflict: "!", unchanged: "=" }
const LABELS = {
  create: "new",
  update: "update",
  merge: "merge into existing",
  conflict: "conflict — saved for manual merge",
  unchanged: "already up to date",
}

class Abort extends Error {}

/** Asks a question, or returns `fallback` in --yes mode. Ctrl+C aborts cleanly. */
async function ask(opts, prompt, fallback) {
  if (opts.yes) return fallback
  const answer = await prompt()
  if (p.isCancel(answer)) throw new Abort("Cancelled — nothing was changed.")
  return answer
}

function describePlan(plan) {
  const lines = plan.actions
    .filter((a) => a.kind !== "unchanged")
    .map((a) => `${SYMBOLS[a.kind]} ${a.path}  (${LABELS[a.kind]}${a.reason && a.kind !== "conflict" ? `: ${a.reason}` : ""})`)
  const unchanged = plan.actions.filter((a) => a.kind === "unchanged").length
  if (unchanged) lines.push(`= ${unchanged} file(s) already up to date`)
  return lines.join("\n")
}

async function ensureShadcn(cwd, opts, detection) {
  if (detection.status === "incompatible") throw new Abort(`Incompatible project: ${detection.reason}`)
  if (detection.status === "ok") return detection

  p.log.warn("This is a React project, but shadcn/ui isn't initialized yet (no components.json).")
  const run = await ask(
    opts,
    () => p.confirm({ message: "Run `npx shadcn@latest init` now? (it asks its own questions)", initialValue: true }),
    false,
  )
  if (!run) throw new Abort("shadcn/ui is required. Run `npx shadcn@latest init`, then re-run this tool.")
  spawnSync("npx", ["shadcn@latest", "init"], { cwd, stdio: "inherit" })
  const after = detectProject(cwd)
  if (after.status !== "ok") throw new Abort("components.json still missing after `shadcn init` — stopping.")
  return after
}

async function chooseStudio(cwd, opts, detection) {
  if (opts.studio !== undefined) return opts.studio
  const previous = readManifest(cwd).studio
  const guess = previous ?? detection.hasStudioRegistries
  return ask(
    opts,
    () =>
      p.select({
        message: "Do you have a Shadcn Studio license?",
        initialValue: guess,
        options: [
          { value: true, label: "Yes", hint: "installs /cui /rui /iui, the install-gate hook, and the @ss-* registries" },
          { value: false, label: "No", hint: "skill + conventions only; components come from `npx shadcn@latest add`" },
        ],
      }),
    guess,
  )
}

async function chooseFigma(cwd, opts) {
  if (opts.figma !== undefined) return opts.figma
  const previous = readManifest(cwd).figma
  return ask(
    opts,
    () =>
      p.select({
        message: "Do you build UI from Figma designs?",
        initialValue: previous ?? true,
        options: [
          { value: true, label: "Yes", hint: "installs /ftc and adds Figma's remote MCP server to .mcp.json (one-time sign-in via /mcp)" },
          { value: false, label: "No", hint: "skips /ftc and the Figma setup" },
        ],
      }),
    previous ?? false,
  )
}

async function offerAgent(cwd, opts, detection, plan, conflicts) {
  const created = plan.actions.find((a) => a.createdClaudeMd)
  if (!created && conflicts.length === 0) return

  const agent = !opts.noAi && hasClaudeCli()
  if (created) {
    const run = agent && (await ask(opts, () => p.confirm({ message: `Let Claude Code fill the [CUSTOMIZE] sections of ${created.path} from your codebase? (uses tokens; edits ${created.path} only)` }), false))
    if (run) {
      p.log.step("Running Claude Code…")
      runClaude(cwd, fillClaudeMdPrompt(created.path, detection), ["Read", "Glob", "Grep", `Edit(./${created.path})`])
    } else {
      p.log.info(`Fill the [CUSTOMIZE] sections of ${created.path} yourself, or later ask Claude Code: "Fill in every [CUSTOMIZE] marker in ${created.path} by reading this codebase."`)
    }
  }
  if (conflicts.length) {
    const run = agent && (await ask(opts, () => p.confirm({ message: `Let Claude Code merge the ${conflicts.length} conflicting file(s)? (it reports contradictions instead of choosing)` }), false))
    if (run) {
      p.log.step("Running Claude Code…")
      const editable = [...new Set(conflicts.map((a) => `Edit(./${a.path})`))]
      runClaude(cwd, mergeConflictsPrompt(conflicts), ["Read", "Glob", "Grep", ...editable])
      p.log.info(`Review the merged files, then delete ${INCOMING_DIR}/.`)
    } else {
      p.log.info(`Merge by hand using ${INCOMING_DIR}/MERGE.md — it also has a ready-made prompt for your AI agent.`)
    }
  }
}

function nextSteps(plan) {
  const steps = []
  const servers = plan.actions.find((a) => a.servers)?.servers ?? []
  if (plan.studio) {
    steps.push("Put your Shadcn Studio EMAIL and LICENSE_KEY in .env (placeholders are in .env.example).")
    if (servers.includes("shadcn-studio-mcp")) {
      steps.push("Export SHADCN_STUDIO_API_KEY and SHADCN_STUDIO_EMAIL in your shell profile — Claude Code fills them into .mcp.json from the environment, not from .env.")
    }
    if (spawnSync("jq", ["--version"], { stdio: "ignore" }).status !== 0) steps.push("Install jq — the Studio install-gate hook needs it (e.g. `brew install jq`).")
  }
  if (plan.figma) {
    steps.push("In Claude Code, run /mcp → figma → Authenticate (one-time browser sign-in). Then try /ftc <Figma URL with node-id>.")
  }
  if (servers.length) steps.push("The first time Claude Code opens this project it asks you to approve the servers in .mcp.json — approve them.")
  steps.push(`Commit .claude/, CLAUDE.md${servers.length || plan.figma ? " and .mcp.json" : ""} so your team gets the same setup.`)
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
}

export async function init(cwd, opts) {
  if (!opts.yes && !process.stdin.isTTY) {
    console.error("No interactive terminal detected. Re-run with --yes (plus --studio/--no-studio and --figma/--no-figma) to accept defaults.")
    return 1
  }
  p.intro("claude-shadcn-cli")
  try {
    const detection = await ensureShadcn(cwd, opts, detectProject(cwd))
    p.note(
      [
        `Framework:        ${detection.framework}`,
        `Package manager:  ${detection.packageManager}`,
        `RSC:              ${detection.rsc ? "yes" : "no"}`,
        `Global CSS:       ${detection.cssFile ?? "not set in components.json"}`,
        `CLAUDE.md:        ${detection.claudeMdPath ?? "none — a skeleton will be created"}`,
      ].join("\n"),
      "Detected",
    )

    const studio = await chooseStudio(cwd, opts, detection)
    const figma = await chooseFigma(cwd, opts)
    const plan = buildPlan(cwd, { studio, figma, detection })
    for (const warning of plan.warnings) p.log.warn(warning)

    if (plan.actions.every((a) => a.kind === "unchanged")) {
      p.outro("Everything is already up to date.")
      return 0
    }
    p.note(describePlan(plan), opts.dryRun ? "Planned changes (dry run)" : "Planned changes")
    if (opts.dryRun) {
      p.outro("Dry run — nothing was written.")
      return 0
    }
    if (!(await ask(opts, () => p.confirm({ message: "Apply these changes?", initialValue: true }), true))) {
      throw new Abort("Nothing was changed.")
    }

    const conflicts = applyPlan(cwd, plan)
    p.log.success("Files written.")
    if (conflicts.length) p.log.warn(`${conflicts.length} file(s) were kept as-is; the template versions are in ${INCOMING_DIR}/.`)

    await offerAgent(cwd, opts, detection, plan, conflicts)
    p.note(nextSteps(plan), "Next steps")
    p.outro("Done.")
    return 0
  } catch (error) {
    if (!(error instanceof Abort)) throw error
    p.cancel(error.message)
    return 1
  }
}
