#!/usr/bin/env node
/**
 * CI enforcement point: fails the build if any commit in the given git
 * range still carries AI attribution. This is the backstop for a commit
 * that never went through the local commit-msg hook (made without husky
 * installed, via the GitHub web UI, or via an API that writes commits
 * directly) - see scripts/attributionPatterns.js for what counts as
 * attribution and why there are three enforcement points.
 *
 * Deliberately does not rewrite anything: rewriting history from CI would
 * mean force-pushing over whatever a contributor has checked out locally.
 * It fails loudly instead, naming the offending commit(s), so reword +
 * force-push happens on the PR author's own branch, which is always safe.
 */
import { execSync } from 'node:child_process';
import { stripAiAttribution } from './attributionPatterns.js';

const range = process.argv[2];
if (!range) {
  console.error('Usage: check-commit-attribution.mjs <git-range>');
  process.exit(1);
}

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';
const log = execSync(`git log --format=%H${FIELD_SEP}%B${RECORD_SEP} ${range}`, {
  encoding: 'utf8',
  maxBuffer: 1024 * 1024 * 32,
});

const records = log
  .split(RECORD_SEP)
  .map((r) => r.trim())
  .filter(Boolean);

const offenders = [];
for (const record of records) {
  const sepIndex = record.indexOf(FIELD_SEP);
  const sha = record.slice(0, sepIndex);
  const message = record.slice(sepIndex + 1);
  const cleaned = stripAiAttribution(message);
  if (cleaned.trim() !== message.trim()) {
    offenders.push({ sha: sha.slice(0, 12), message });
  }
}

if (offenders.length > 0) {
  console.error(
    'Commit message(s) contain AI attribution (Co-Authored-By / "Generated with" / a claude.ai session link), which this repo does not allow:\n',
  );
  for (const o of offenders) {
    console.error(
      `  ${o.sha}:\n${o.message
        .split('\n')
        .map((l) => '    ' + l)
        .join('\n')}\n`,
    );
  }
  console.error(
    'Reword the offending commit(s) (e.g. `git commit --amend` or an interactive rebase on your own branch) and force-push, then re-run CI.',
  );
  process.exit(1);
}

console.log(`Checked ${records.length} commit(s) in range "${range}" - no AI attribution found.`);
