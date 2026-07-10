// Documentation consistency checker for Cozy Pocket.
//
// Guards the docs system against the drift that accumulates by hand:
//   1. broken relative links in the tracked markdown set
//   2. plan-language left behind in completed-reference records
//   3. reference docs that nothing links to (orphans)
//
// Zero dependencies; run via `npm run docs:check`. Exits non-zero on any problem.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TODO_REF_DIR = join(ROOT, 'docs/todo-references');
const DONE_REF_DIR = join(ROOT, 'docs/completed-references');

// Markers that mean a completed-reference file still reads as a plan, not a record.
const PLAN_LANGUAGE_MARKERS = [
  '實作計劃',
  '測試計劃',
  '本項目實作時會使用新的 git worktree',
  '建議 worktree 路徑',
];

const problems = [];
const report = (file, message) => problems.push({ file: relative(ROOT, file), message });

const listMarkdown = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => name.endsWith('.md'))
        .map((name) => join(dir, name))
    : [];

// The tracked markdown set: top-level docs plus everything under docs/.
const walkDocs = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkDocs(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
};

const trackedMarkdown = [
  ...['README.md', 'TODO.md', 'AGENTS.md', 'CLAUDE.md', 'CHANGELOG.md']
    .map((name) => join(ROOT, name))
    .filter(existsSync),
  ...walkDocs(join(ROOT, 'docs')),
];

// 1. Broken relative links. Skips external URLs, pure anchors, and template
//    placeholders like docs/todo-references/<slug>.md in the workflow guide.
const LINK_RE = /\]\(([^)]+)\)/g;
for (const file of trackedMarkdown) {
  const body = readFileSync(file, 'utf8');
  for (const match of body.matchAll(LINK_RE)) {
    const target = match[1].split('#')[0].trim();
    if (!target) continue;
    if (/^(https?:|mailto:)/.test(target)) continue;
    if (target.includes('<') || target.includes('>')) continue;
    const resolved = resolve(dirname(file), target);
    if (!existsSync(resolved)) report(file, `broken link -> ${target}`);
  }
}

// 2. Plan-language markers in completed references.
for (const file of listMarkdown(DONE_REF_DIR)) {
  const body = readFileSync(file, 'utf8');
  for (const marker of PLAN_LANGUAGE_MARKERS) {
    if (body.includes(marker)) report(file, `completed record still contains plan language: "${marker}"`);
  }
}

// 3. Orphan references. Every plan must be linked from TODO.md; every completed
//    record must be linked from TODO.md, CHANGELOG.md, or README.md.
const readIfExists = (name) => {
  const full = join(ROOT, name);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
};
const todoBody = readIfExists('TODO.md');
const doneSources = ['TODO.md', 'CHANGELOG.md', 'README.md'].map(readIfExists).join('\n');

for (const file of listMarkdown(TODO_REF_DIR)) {
  const name = file.split('/').pop();
  if (!todoBody.includes(name)) report(file, 'plan is not linked from TODO.md');
}
for (const file of listMarkdown(DONE_REF_DIR)) {
  const name = file.split('/').pop();
  if (!doneSources.includes(name)) report(file, 'completed record is not linked from TODO.md, CHANGELOG.md, or README.md');
}

if (problems.length === 0) {
  console.log(`docs-check: OK (${trackedMarkdown.length} markdown files scanned)`);
  process.exit(0);
}

console.error(`docs-check: ${problems.length} problem(s) found\n`);
for (const { file, message } of problems) console.error(`  ${file}: ${message}`);
process.exit(1);
