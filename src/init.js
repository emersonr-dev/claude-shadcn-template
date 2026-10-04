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
          { value: true, label: "Yes", hint: "installs /cui /rui /iui /ftc, the install-gate hook, and the @ss-* registries" },
          { value: false, label: "No", hint: "skill + conventions only; components come from `npx shadcn@latest add`" },
        ],
      }),
    guess,
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

function nextSteps(studio) {
  const steps = []
  if (studio) {
    steps.push("Put your Shadcn Studio EMAIL and LICENSE_KEY in .env (placeholders are in .env.example).")
    steps.push("Connect the shadcn-studio-mcp MCP server in Claude Code (see shadcnstudio.com docs).")
    if (spawnSync("jq", ["--version"], { stdio: "ignore" }).status !== 0) steps.push("Install jq — the Studio install-gate hook needs it (e.g. `brew install jq`).")
  }
  steps.push("Commit .claude/ and CLAUDE.md so your team gets the same setup.")
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
}

export async function init(cwd, opts) {
  if (!opts.yes && !process.stdin.isTTY) {
    console.error("No interactive terminal detected. Re-run with --yes (and --studio or --no-studio) to accept defaults.")
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
    const plan = buildPlan(cwd, { studio, detection })
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
    p.note(nextSteps(studio), "Next steps")
    p.outro("Done.")
    return 0
  } catch (error) {
    if (!(error instanceof Abort)) throw error
    p.cancel(error.message)
    return 1
  }
}
