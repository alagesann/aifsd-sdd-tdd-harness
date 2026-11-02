// scripts/spec-coverage.mjs
// Sensor: spec → test traceability.
// Every scenario in openspec/specs/, plus every scenario in an active change that has
// started implementation (≥1 task ticked), must be referenced by a test titled
// "[scenario: <capability>/<scenario name>]". Tags pointing at unknown scenarios fail too,
// which catches renamed or deleted scenarios.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const specFiles = (root) =>
  existsSync(root)
    ? readdirSync(root, { recursive: true })
        .filter((f) => f.endsWith("spec.md"))
        .map((f) => ({ root, file: join(root, f) }))
    : [];

const scenariosIn = ({ root, file }) =>
  [...readFileSync(file, "utf8").matchAll(/^#### Scenario: (.+)$/gm)].map(
    (m) => `${relative(root, dirname(file))}/${m[1].trim()}`
  );

const changes = readdirSync("openspec/changes", { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "archive")
  .map((d) => join("openspec/changes", d.name));
const started = (c) =>
  existsSync(join(c, "tasks.md")) && /^\s*- \[[xX]\]/m.test(readFileSync(join(c, "tasks.md"), "utf8"));

const ids = (files) => new Set(files.flatMap(scenariosIn));
const required = ids([
  ...specFiles("openspec/specs"),
  ...changes.filter(started).flatMap((c) => specFiles(join(c, "specs"))),
]);
const known = new Set([...required, ...ids(changes.flatMap((c) => specFiles(join(c, "specs"))))]);

const testSrc = readdirSync("test", { recursive: true })
  .filter((f) => /\.test\.[cm]?[jt]s$/.test(f))
  .map((f) => readFileSync(join("test", f), "utf8"))
  .join("\n");
const tagged = new Set([...testSrc.matchAll(/\[scenario: ([^\]]+)\]/g)].map((m) => m[1].trim()));

const missing = [...required].filter((id) => !tagged.has(id));
const orphans = [...tagged].filter((id) => !known.has(id));

console.log(`spec-coverage: ${required.size - missing.length}/${required.size} scenarios covered`);
missing.forEach((id) => console.error(`  ✗ no test for scenario "${id}"`));
orphans.forEach((id) => console.error(`  ✗ test references unknown scenario "${id}" (renamed or removed?)`));
process.exit(missing.length || orphans.length ? 1 : 0);
