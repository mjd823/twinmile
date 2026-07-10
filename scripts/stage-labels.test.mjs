/**
 * Stage-label taxonomy guard — run with `npm test` (node --test, no deps).
 *
 * lib/pipeline-stages.ts is the single source of truth for pipeline stage
 * labels; its header bans pages/components from defining their own. This test
 * scans components/ and app/ for the exact off-taxonomy literals an
 * adversarial review previously found, so they can never come back.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_DIRS = ["components", "app"];
const EXTENSIONS = new Set([".ts", ".tsx"]);

/** Off-taxonomy stage-label literals. Canonical labels live ONLY in lib/pipeline-stages.ts. */
const FORBIDDEN = [
  {
    why: 'stale "Engaged (clicked)" — canonical label is "Engaged (clicked link)"',
    re: /Engaged \(clicked\)["'<]/,
  },
  {
    why: 'wrong-case "Prospects sourced" — canonical label is "Prospects Sourced"',
    re: /Prospects sourced/,
  },
  {
    why: 'stale "Invited (onboarding link created)" — canonical label is "Invited (email sent)"',
    re: /Invited \(onboarding link created\)/,
  },
  {
    why: 'page-local quote stage "Quoted" — the module folds the quoted status into Negotiating',
    re: /label:\s*["']Quoted["']/,
  },
  {
    why: '"Onboarding" used as a stage label — the taxonomy calls this stage "Invited" (or "Completed" for finished onboarding)',
    re: /label=["']Onboarding["']|,\s*["']Onboarding["']\s*,/,
  },
  {
    why: '"Converted" used as a stage tile label — the taxonomy calls this stage "Hired"',
    re: /label=["']Converted["']|,\s*["']Converted["']\s*,/,
  },
  {
    why: 'hardcoded "Invited" label — import stageDef("invited").shortLabel from lib/pipeline-stages',
    re: /label=["']Invited["']/,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      yield full;
    }
  }
}

test("no page or component defines its own pipeline stage labels", () => {
  const violations = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      for (const { why, re } of FORBIDDEN) {
        const m = re.exec(text);
        if (m) {
          const line = text.slice(0, m.index).split("\n").length;
          violations.push(`${relative(ROOT, file)}:${line} — ${why}`);
        }
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Stage labels must come from lib/pipeline-stages.ts:\n${violations.join("\n")}`
  );
});

test("lib/pipeline-stages.ts still carries the canonical labels", () => {
  const src = readFileSync(join(ROOT, "lib", "pipeline-stages.ts"), "utf8");
  for (const canonical of [
    "Prospects Sourced",
    "Invited (email sent)",
    "Engaged (clicked link)",
    "Hired / Active",
  ]) {
    assert.ok(src.includes(canonical), `missing canonical label: ${canonical}`);
  }
});
