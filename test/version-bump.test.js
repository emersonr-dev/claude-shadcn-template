import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { checkBump, isGreater, shippedChanges } from "../scripts/check-version-bump.mjs"
import { PKG_ROOT } from "../src/util.js"

const files = JSON.parse(readFileSync(join(PKG_ROOT, "package.json"), "utf8")).files
const pkg = (version, dependencies = { "@clack/prompts": "^1.8.1" }) => ({ version, files, dependencies })

test("version check: shipped paths come from package.json's files field", () => {
  const changed = ["src/plan.js", ".claude/commands/ftc.md", ".claude/settings.local.json", "README.md", "test/cli.test.js", ".github/workflows/ci.yml", "srcx/file.js"]
  assert.deepEqual(shippedChanges(changed, files), ["src/plan.js", ".claude/commands/ftc.md"])
})

test("version check: semver comparison", () => {
  assert.ok(isGreater("0.2.4", "0.2.3"))
  assert.ok(isGreater("0.10.0", "0.9.9"))
  assert.ok(isGreater("1.0.0", "1.0.0-beta.1"))
  assert.ok(!isGreater("0.2.3", "0.2.3"))
  assert.ok(!isGreater("0.2.2", "0.2.3"))
})

test("version check: shipped change without a bump fails, with a fix hint", () => {
  const result = checkBump({ basePkg: pkg("0.2.3"), headPkg: pkg("0.2.3"), changedPaths: ["src/render.js"] })
  assert.equal(result.ok, false)
  assert.match(result.message, /src\/render\.js/)
  assert.match(result.message, /npm version patch/)
})

test("version check: shipped change with a bump passes", () => {
  assert.ok(checkBump({ basePkg: pkg("0.2.3"), headPkg: pkg("0.2.4"), changedPaths: ["src/render.js"] }).ok)
})

test("version check: docs, tests and CI changes need no bump", () => {
  assert.ok(checkBump({ basePkg: pkg("0.2.3"), headPkg: pkg("0.2.3"), changedPaths: ["README.md", "test/smoke.sh", ".github/workflows/ci.yml"] }).ok)
})

test("version check: a runtime dependency change needs a bump; dev dependencies don't", () => {
  const changedPaths = ["package.json", "package-lock.json"]
  assert.equal(checkBump({ basePkg: pkg("0.2.3"), headPkg: pkg("0.2.3", { "@clack/prompts": "^2.0.0" }), changedPaths }).ok, false)
  assert.ok(checkBump({ basePkg: { ...pkg("0.2.3"), devDependencies: {} }, headPkg: { ...pkg("0.2.3"), devDependencies: { x: "1" } }, changedPaths }).ok)
})
