import { homedir } from "node:os"
import { join } from "node:path"
import { readJson } from "./util.js"

export const MCP_JSON = ".mcp.json"

// Figma's remote MCP server: OAuth via `/mcp` → figma → Authenticate, so no
// secret lives in the file and it's safe to commit for the whole team.
export const FIGMA_SERVER = { type: "http", url: "https://mcp.figma.com/mcp" }

// Shadcn Studio's server takes its credentials as arguments. Claude Code expands
// ${VAR} from the shell environment (not .env), and the `:-` default keeps the
// file parseable for anyone who hasn't set them yet.
export const STUDIO_SERVER = {
  command: "npx",
  args: ["-y", "shadcn-studio-mcp", "API_KEY=${SHADCN_STUDIO_API_KEY:-}", "EMAIL=${SHADCN_STUDIO_EMAIL:-}"],
}

const isFigma = (name, config) => name === "figma" || /mcp\.figma\.com|127\.0\.0\.1:3845/.test(config?.url ?? "")
const isStudio = (name, config) => name === "shadcn-studio-mcp" || (config?.args ?? []).includes("shadcn-studio-mcp")

/**
 * MCP servers this user already has outside the project's .mcp.json: user scope
 * and local (per-project) scope, both stored in ~/.claude.json. Best effort —
 * an unreadable file just means "none found".
 */
export function personalServers(cwd, claudeJsonPath = join(homedir(), ".claude.json")) {
  try {
    const config = readJson(claudeJsonPath) ?? {}
    return { ...config.mcpServers, ...config.projects?.[cwd]?.mcpServers }
  } catch {
    return {}
  }
}

/**
 * Adds the servers this setup needs to the project's .mcp.json, skipping any the
 * project or the user already has (under any name). Never edits existing entries.
 *
 * Returns `personalOnly`: servers skipped *only* because this user has them in
 * their own config. Those are the ones where the skip is invisible but not
 * harmless — the project file is what teammates get, and a server nobody
 * declared there is a server only this machine has. The caller warns; writing
 * someone's personal setup into a shared, committed file isn't ours to decide.
 */
export function mergeMcpJson(existing, { figma, studio, personal }) {
  const out = structuredClone(existing ?? {})
  out.mcpServers ??= {}
  const hasIn = (servers, test) => Object.entries(servers ?? {}).some(([name, config]) => test(name, config))
  const added = []
  const personalOnly = []
  const wanted = [
    [figma, isFigma, "figma", FIGMA_SERVER],
    [studio, isStudio, "shadcn-studio-mcp", STUDIO_SERVER],
  ]
  for (const [want, test, name, config] of wanted) {
    if (!want || hasIn(out.mcpServers, test)) continue
    if (hasIn(personal, test)) {
      personalOnly.push(name)
      continue
    }
    out.mcpServers[name] = config
    added.push(name)
  }
  return { result: out, added, personalOnly }
}
