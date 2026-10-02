import { existsSync } from "node:fs"
import { join } from "node:path"
import { readJson } from "./util.js"

const FRAMEWORKS = [
  ["next", "Next.js"],
  ["@tanstack/react-start", "TanStack Start"],
  ["@react-router/dev", "React Router (framework mode)"],
  ["@remix-run/react", "Remix"],
  ["astro", "Astro (React islands)"],
  ["vite", "Vite"],
  ["react-scripts", "Create React App"],
]

const LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
]

function detectFramework(cwd, deps) {
  const match = FRAMEWORKS.find(([dep]) => deps[dep])
  if (!match) return "React (unrecognized setup)"
  if (match[0] !== "next") return match[1]
  const hasApp = ["app", "src/app"].some((d) => existsSync(join(cwd, d)))
  const hasPages = ["pages", "src/pages"].some((d) => existsSync(join(cwd, d)))
  if (hasApp && hasPages) return "Next.js (App Router + Pages Router)"
  if (hasApp) return "Next.js (App Router)"
  if (hasPages) return "Next.js (Pages Router)"
  return "Next.js"
}

/**
 * Inspects the target project. `status` is one of:
 *   "incompatible"      — not a React project (or unreadable config); stop.
 *   "needs-shadcn-init" — React project without components.json yet.
 *   "ok"                — React + shadcn/ui; ready to install.
 */
export function detectProject(cwd) {
  let pkg
  try {
    pkg = readJson(join(cwd, "package.json"))
  } catch {
    return { status: "incompatible", reason: "package.json is not valid JSON." }
  }
  if (!pkg) {
    return {
      status: "incompatible",
      reason: `No package.json found in ${cwd}. Run this from your project's root (in a monorepo, the app package that uses shadcn/ui).`,
    }
  }

  const deps = { ...pkg.peerDependencies, ...pkg.devDependencies, ...pkg.dependencies }
  if (!deps.react) {
    return {
      status: "incompatible",
      reason: "`react` is not a dependency in package.json. This tool only supports React + shadcn/ui projects.",
    }
  }

  let componentsJson
  try {
    componentsJson = readJson(join(cwd, "components.json"))
  } catch {
    return { status: "incompatible", reason: "components.json exists but is not valid JSON. Fix it and re-run." }
  }

  const packageManager = LOCKFILES.find(([file]) => existsSync(join(cwd, file)))?.[1] ?? "npm"

  return {
    status: componentsJson ? "ok" : "needs-shadcn-init",
    framework: detectFramework(cwd, deps),
    reactVersion: deps.react,
    tailwindVersion: deps.tailwindcss,
    typescript: Boolean(deps.typescript) || existsSync(join(cwd, "tsconfig.json")),
    packageManager,
    scripts: pkg.scripts ?? {},
    componentsJson,
    rsc: componentsJson?.rsc === true,
    cssFile: componentsJson?.tailwind?.css || undefined,
    hasStudioRegistries: Boolean(componentsJson?.registries?.["@ss-components"]),
    claudeMdPath: ["CLAUDE.md", ".claude/CLAUDE.md"].find((p) => existsSync(join(cwd, p))),
    hasClaudeDir: existsSync(join(cwd, ".claude")),
  }
}
