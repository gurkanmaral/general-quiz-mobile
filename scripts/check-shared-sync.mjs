#!/usr/bin/env node
/**
 * Fails when the code this app shares with general-quiz-backend has drifted: the zod contracts in
 * src/contracts and the streak/rotation rules in src/shared. The backend is the source of truth;
 * copy its files here after a change.
 *
 *   node scripts/check-shared-sync.mjs [path to general-quiz-backend]   (default ../general-quiz-backend)
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const app = resolve(import.meta.dirname, '..');
const api = resolve(process.argv[2] ?? join(app, '..', 'general-quiz-backend'));

const SHARED_RULES = ['knoSchedule.ts', 'knoStreak.ts', 'index.ts'];

const sources = async (dir) => (await readdir(dir)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).sort();

const pairs = [];
const problems = [];

const mine = await sources(join(app, 'src/contracts'));
const theirs = await sources(join(api, 'src/contracts'));
for (const name of mine.filter((n) => !theirs.includes(n))) problems.push(`src/contracts/${name} exists only in the mobile app`);
for (const name of theirs.filter((n) => !mine.includes(n))) problems.push(`src/contracts/${name} exists only in the backend`);
for (const name of mine.filter((n) => theirs.includes(n))) pairs.push(`src/contracts/${name}`);
for (const name of SHARED_RULES) pairs.push(`src/shared/${name}`);

for (const path of pairs) {
  const [a, b] = await Promise.all([readFile(join(app, path), 'utf8'), readFile(join(api, path), 'utf8')]);
  if (a !== b) problems.push(`${path} differs from the backend`);
}

if (problems.length) {
  console.error(`Shared code is out of sync with ${api}:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  console.error('Copy the backend version into this app so the API and the app agree.');
  process.exit(1);
}
console.log(`Shared code in sync (${pairs.length} files).`);
