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
 */
export function mergeMcpJson(existing, { figma, studio, personal }) {
  const out = structuredClone(existing ?? {})
  out.mcpServers ??= {}
  const has = (test) =>
    [out.mcpServers, personal].some((servers) => Object.entries(servers ?? {}).some(([name, config]) => test(name, config)))
  const added = []
  if (figma && !has(isFigma)) {
    out.mcpServers.figma = FIGMA_SERVER
    added.push("figma")
  }
  if (studio && !has(isStudio)) {
    out.mcpServers["shadcn-studio-mcp"] = STUDIO_SERVER
    added.push("shadcn-studio-mcp")
  }
  return { result: out, added }
}
