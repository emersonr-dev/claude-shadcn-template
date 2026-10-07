import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { readManifest } from "./plan.js"
import { refreshCommand } from "./render.js"
import { INCOMING_DIR, MANIFEST, PKG_ROOT, readJson, sha256, toJson } from "./util.js"

function write(cwd, path, content, mode) {
  const target = join(cwd, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
  if (mode) chmodSync(target, mode)
}

export function mergeChecklist(conflicts, command = refreshCommand(false)) {
  const rows = conflicts.map((a) => `- [ ] \`${a.path}\` ← \`${INCOMING_DIR}/${a.path}\` (${a.reason})`).join("\n")
  return `# claude-shadcn-cli: files to merge

These files already existed in your project and differ from the template, so they were **not** overwritten.
The template's version of each is saved in this folder. Merge what you want, then delete this folder.

${rows}

## Let your AI agent do it

Paste this into Claude Code (or run \`${command}\` again and accept the merge step):

> For each unchecked file in ${INCOMING_DIR}/MERGE.md, compare my version with the template version in ${INCOMING_DIR}/. Merge in what the template adds without removing my project-specific instructions, keep my wording where both cover the same rule, and tell me about any rule where the two contradict instead of choosing for me. Don't edit anything inside ${INCOMING_DIR}/.
`
}

/** Writes a plan to disk. Returns the conflicts that need a manual (or agent) merge. */
export function applyPlan(cwd, plan) {
  const conflicts = plan.actions.filter((a) => a.kind === "conflict")
  for (const action of plan.actions) {
    if (["create", "update", "merge"].includes(action.kind)) write(cwd, action.path, action.content, action.mode)
  }
  for (const action of conflicts) write(cwd, join(INCOMING_DIR, action.path), action.content)
  if (conflicts.length) write(cwd, join(INCOMING_DIR, "MERGE.md"), mergeChecklist(conflicts, plan.refreshCommand))

  // Remember what we installed, so the next run can tell untouched files (safe to update) from user edits.
  const manifest = readManifest(cwd)
  for (const action of plan.actions) {
    if (action.owned && action.kind !== "conflict") manifest.files[action.path] = sha256(action.content)
  }
  const { version } = readJson(join(PKG_ROOT, "package.json"))
  write(cwd, MANIFEST, toJson({ version, studio: plan.studio, figma: plan.figma, files: manifest.files }))
  return conflicts
}
