import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

/** Root of the installed claude-shadcn-cli package (where the template files ship). */
export const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url))

export const MANAGED_MD = ".claude/claude-shadcn.md"
export const MANIFEST = ".claude/.claude-shadcn-manifest.json"
export const INCOMING_DIR = ".claude-shadcn-incoming"

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex")
}

export function readText(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined
}

/** Returns undefined when the file is missing; throws on invalid JSON. */
export function readJson(path) {
  const text = readText(path)
  return text === undefined ? undefined : JSON.parse(text)
}

export function toJson(value) {
  return JSON.stringify(value, null, 2) + "\n"
}

/** Lists files under `dir` (recursively) as POSIX paths relative to `base`. */
export function listFiles(base, dir) {
  const root = join(base, dir)
  if (!existsSync(root)) return []
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(base, join(entry.parentPath ?? entry.path, entry.name)).split(sep).join("/"))
    .sort()
}
