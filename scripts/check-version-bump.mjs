#!/usr/bin/env node
// Fails a PR that changes what the package ships without raising its version,
// so every user-facing change can actually be released (the release workflow
// only accepts a tag that matches package.json's version).
//
// Usage (from CI): node scripts/check-version-bump.mjs <base-ref>
// "Shipped" = package.json's `files` entries plus its runtime `dependencies`.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

/** Changed paths that end up in the published package. */
export function shippedChanges(changedPaths, files) {
  return changedPaths.filter((path) => files.some((entry) => path === entry || path.startsWith(`${entry}/`)))
}

/** True when semver `a` is greater than `b` (prerelease tags compare lower than the release). */
export function isGreater(a, b) {
  const parse = (v) => {
    const [core, pre] = v.split("-", 2)
    return { nums: core.split(".").map(Number), pre }
  }
  const x = parse(a)
  const y = parse(b)
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] > y.nums[i]
  if (x.pre === y.pre) return false
  if (x.pre === undefined) return true
  if (y.pre === undefined) return false
  return x.pre > y.pre
}

/** Returns { ok, message } for a PR, given both sides' package.json and its changed paths. */
export function checkBump({ basePkg, headPkg, changedPaths }) {
  const shipped = shippedChanges(changedPaths, headPkg.files ?? [])
  const depsChanged = JSON.stringify(basePkg.dependencies ?? {}) !== JSON.stringify(headPkg.dependencies ?? {})
  if (shipped.length === 0 && !depsChanged) {
    return { ok: true, message: "No shipped files or runtime dependencies changed; no version bump needed." }
  }
  if (isGreater(headPkg.version, basePkg.version)) {
    return { ok: true, message: `Shipped changes with a version bump: ${basePkg.version} → ${headPkg.version}.` }
  }
  const reasons = [...shipped.map((p) => `  - ${p}`), ...(depsChanged ? ["  - package.json dependencies"] : [])]
  return {
    ok: false,
    message: [
      `This PR changes what the package ships, but the version is still ${headPkg.version} (base: ${basePkg.version}):`,
      ...reasons.slice(0, 20),
      ...(reasons.length > 20 ? [`  …and ${reasons.length - 20} more`] : []),
      "",
      "Bump it so the change can be released, e.g.:",
      "  npm version patch --no-git-tag-version   (or minor, for new features)",
      "If this change really shouldn't be released (e.g. comments only), add the `skip-version-check` label.",
    ].join("\n"),
  }
}

function main() {
  const baseRef = process.argv[2]
  if (!baseRef) throw new Error("usage: check-version-bump.mjs <base-ref>")
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" })
  const result = checkBump({
    basePkg: JSON.parse(git("show", `${baseRef}:package.json`)),
    headPkg: JSON.parse(readFileSync("package.json", "utf8")),
    changedPaths: git("diff", "--name-only", `${baseRef}...HEAD`).split("\n").filter(Boolean),
  })
  console.log(result.message)
  if (!result.ok) {
    console.log(`::error title=Version bump required::${result.message.split("\n")[0]}`)
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
