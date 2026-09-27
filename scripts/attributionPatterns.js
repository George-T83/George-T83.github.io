/**
 * Single source of truth for "what counts as AI attribution" in this repo,
 * shared by the commit-msg hook (strips it before a commit is even created),
 * the CI commit-range check (catches anything that reached a commit anyway -
 * e.g. made without husky installed, or via the GitHub UI/API), and the
 * PR-body-scrubber workflow (catches footers a tool injects server-side,
 * after the fact, that never appeared in the text a session actually wrote).
 * One definition here means all three enforcement points agree on what to
 * remove instead of drifting apart over time.
 */

/**
 * Strips Co-Authored-By trailers, "Generated with/by Claude" footers (with
 * or without a leading emoji/markdown link/em-dash rule), and bare
 * claude.ai session links from `text`. Safe to call on commit messages, PR
 * bodies, or any other free text - returns the input unchanged if none of
 * the patterns match.
 */
function stripAiAttribution(text) {
  if (!text) return text;
  let out = text;

  // "---\n_Generated with/by [Claude Code](...)_ " style footer blocks,
  // including a leading divider rule and optional robot emoji/markdown link/
  // italics - the exact shape both `git commit`-style tooling and the
  // GitHub PR-creation footer use.
  out = out.replace(
    /\n{0,2}-{3,}\s*\n+\s*(?:🤖\s*)?_{0,2}\**\s*Generated (?:with|by)\s*(?:\[?Claude Code\]?)[^\n]*\n?/gi,
    '\n',
  );

  // Any remaining stray "Generated with/by Claude Code" line not wrapped in
  // the footer-block shape above. Anchored to the *start* of the line (past
  // only decorative emoji/markdown) rather than "contains anywhere" - a
  // sentence that merely mentions the phrase in prose (e.g. describing this
  // very stripping behavior) must never be treated as the footer itself.
  out = out.replace(
    /^\s*(?:🤖\s*)?_{0,2}\**\s*Generated (?:with|by)\s*\[?Claude Code\]?.*$/gim,
    '',
  );

  // Co-Authored-By trailers - this repo has exactly one legitimate author,
  // so any Co-Authored-By line (Claude's or otherwise) is unwanted here.
  out = out.replace(/^Co-Authored-By:.*$/gim, '');

  // "Claude-Session: <url>" trailers and bare claude.ai session links sitting
  // alone on their own line.
  out = out.replace(/^\s*(?:Claude-Session:\s*)?https:\/\/claude\.ai\/\S*\s*$/gim, '');

  // Collapse a divider rule left dangling with nothing after it, and any
  // run of 3+ blank lines the removals above left behind.
  out = out.replace(/\n{0,2}-{3,}\s*$/g, '');
  out = out.replace(/\n{3,}/g, '\n\n');

  return out.trim().length === 0 ? out.trim() : out.trim() + '\n';
}

module.exports = { stripAiAttribution };
