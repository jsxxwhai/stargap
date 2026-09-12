/** Rendering: terminal table, Markdown report, and JSON. No dependencies. */

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
};

export function supportsColor(stream = process.stdout) {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(stream?.isTTY);
}

export function paint(text, code, enabled) {
  return enabled ? `${code}${text}${ANSI.reset}` : text;
}

function formatStars(stars) {
  if (stars >= 1000) return `${(stars / 1000).toFixed(stars >= 10000 ? 0 : 1)}k`;
  return String(stars);
}

/** Human-readable terminal report. */
export function renderTerminal(profile, gaps, { color = supportsColor() } = {}) {
  const lines = [];
  lines.push(paint(`stargap — ${profile.fullName}`, ANSI.bold, color));
  const noun = gaps.length === 1 ? "repo" : "repos";
  lines.push(
    paint(
      `${gaps.length} high-star ${noun} that could list you but do not yet`,
      ANSI.dim,
      color,
    ),
  );
  lines.push("");

  if (!gaps.length) {
    lines.push("No gaps found. Try a broader query with --query, or lower --min-stars.");
    return lines.join("\n");
  }

  const width = Math.max(24, ...gaps.map((gap) => gap.fullName.length));
  for (const [index, gap] of gaps.entries()) {
    const score = paint(String(gap.score).padStart(5), gap.score >= 60 ? ANSI.green : ANSI.yellow, color);
    const stars = formatStars(gap.stars).padStart(6);
    lines.push(`${String(index + 1).padStart(2)}. ${score}  ${stars}  ${gap.fullName.padEnd(width)}  ${paint(gap.reason, ANSI.dim, color)}`);
    if (gap.description) lines.push(`    ${paint(gap.description.slice(0, 120), ANSI.dim, color)}`);
  }
  lines.push("");
  lines.push(paint("Next: stargap <owner/repo> --markdown --out GAPS.md", ANSI.cyan, color));
  return lines.join("\n");
}

/** Markdown report, designed to be pasted into an issue or PR. */
export function renderMarkdown(profile, gaps, { generatedAt = new Date() } = {}) {
  const lines = [];
  lines.push(`# stargap report: \`${profile.fullName}\``);
  lines.push("");
  lines.push(`Generated ${generatedAt.toISOString()} · ${gaps.length} gap${gaps.length === 1 ? "" : "s"} found.`);
  lines.push("");
  if (profile.description) {
    lines.push(`> ${profile.description}`);
    lines.push("");
  }
  if (!gaps.length) {
    lines.push("No gaps found. Try a broader query with `--query`, or lower `--min-stars`.");
    return lines.join("\n");
  }

  lines.push("| # | Repo | Stars | Score | Why |");
  lines.push("|---|------|-------|-------|-----|");
  for (const [index, gap] of gaps.entries()) {
    lines.push(`| ${index + 1} | [${gap.fullName}](${gap.url}) | ${gap.stars.toLocaleString("en-US")} | ${gap.score} | ${gap.reason} |`);
  }
  lines.push("");
  lines.push("## Suggested entries");
  lines.push("");
  for (const gap of gaps) {
    lines.push(`### [${gap.fullName}](${gap.url})`);
    lines.push("");
    lines.push("```markdown");
    lines.push(gap.entry);
    lines.push("```");
    lines.push("");
  }
  lines.push("## How to use this list");
  lines.push("");
  lines.push("1. Read each repo's CONTRIBUTING.md and follow it exactly.");
  lines.push("2. Open one PR per list, with a short explanation of why the entry fits.");
  lines.push("3. Never mass-open identical PRs; that gets you blocked and reads as spam.");
  return lines.join("\n");
}

export function renderJson(profile, gaps, { generatedAt = new Date() } = {}) {
  return JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: generatedAt.toISOString(),
      repo: profile.fullName,
      query: profile.query ?? null,
      gaps,
    },
    null,
    2,
  );
}
