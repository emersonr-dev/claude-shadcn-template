import { spawnSync } from "node:child_process"
import { INCOMING_DIR } from "./util.js"

export function hasClaudeCli() {
  const result = spawnSync("claude", ["--version"], { stdio: "ignore" })
  return result.status === 0
}

/**
 * Runs Claude Code headless with a narrow tool allowlist, streaming its output.
 * Anything outside `allowedTools` is denied in -p mode, so it can only read the
 * project and edit the files named there.
 */
export function runClaude(cwd, prompt, allowedTools) {
  const result = spawnSync("claude", ["-p", prompt, "--allowedTools", allowedTools.join(",")], { cwd, stdio: "inherit" })
  return result.status === 0
}

export function fillClaudeMdPrompt(claudeMdPath, detection) {
  return `You are filling in the ${claudeMdPath} that claude-shadcn-cli just created for this project.

Detected stack: ${detection.framework}, React ${detection.reactVersion}${detection.tailwindVersion ? `, Tailwind CSS ${detection.tailwindVersion}` : ""}, ${detection.typescript ? "TypeScript" : "JavaScript"}, package manager ${detection.packageManager}, React Server Components ${detection.rsc ? "enabled" : "not used"}.

Task: replace every \`[CUSTOMIZE]\` marker in ${claudeMdPath} with a short, factual description of THIS project, based only on what you can verify by reading package.json, config files, and the source tree.
- Keep each section brief: 1–5 lines or bullets. No marketing language, no guesses — if something can't be determined, write "Not determined yet — fill in manually" for that item.
- "Initial configuration": list the env vars the code actually reads (search for process.env / import.meta.env and any .env.example). Never copy secret values.
- "Architecture": framework + version, routing, RSC usage, state management, data fetching, and one short subsection per major integration you find (auth, database, CMS, API layer).
- "domain-specific pipelines": if a recurring "add a new X" pattern clearly exists, describe it in one or two lines; otherwise delete that subsection.
- "Other notes": theming, animation, testing, deployment — only what you find.
- Remove the template note and every \`[CUSTOMIZE]\` marker. Leave the "shadcn/ui conventions" section and its @.claude/claude-shadcn.md import line exactly as they are.
- Only edit ${claudeMdPath}.`
}

export function mergeConflictsPrompt(conflicts) {
  const list = conflicts.map((a) => `- ${a.path} (template version: ${INCOMING_DIR}/${a.path})`).join("\n")
  return `claude-shadcn-cli could not install these files because the project already has its own version:

${list}

For each file: compare the project's version with the template version, and merge in what the template adds without removing the project's own instructions. Where both cover the same rule, keep the project's wording. Where they contradict each other, do NOT choose — keep the project's version and list the contradiction in your final reply. Do not edit anything inside ${INCOMING_DIR}/. End with a short summary per file.`
}
