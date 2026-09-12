import { test } from "node:test";
import assert from "node:assert/strict";
import { auditRepo, gradeColor, renderBadge } from "../src/audit.mjs";
import {
  renderAuditJson,
  renderAuditMarkdown,
  renderAuditTerminal,
} from "../src/report.mjs";

const NOW = new Date("2026-09-12T00:00:00.000Z");

const strongRepo = {
  fullName: "acme/widget",
  name: "widget",
  description: "A tiny, fast command runner for teams that ship from the terminal.",
  topics: ["cli", "developer-tools", "automation", "productivity", "terminal", "nodejs"],
  homepage: "https://widget.example.com",
  license: { spdxId: "MIT" },
  stars: 12000,
  pushedAt: "2026-09-01T00:00:00.000Z",
};

const strongReadme = `# widget

A tiny, fast command runner for teams that ship from the terminal. It turns repeated project commands into one discoverable command with clear output.

[![CI](https://github.com/acme/widget/actions/workflows/ci.yml/badge.svg)](https://github.com/acme/widget/actions/workflows/ci.yml)
[![demo](https://example.com/demo.png)](https://widget.example.com)

## Installation

\`\`\`bash
npm install -g widget
\`\`\`

## Usage

\`\`\`bash
widget test
\`\`\`

## Features

Fast, small and scriptable.

## Contributing

Read CONTRIBUTING.md.

## Security

Report issues privately.

## License

MIT
`;

const strongGaps = Array.from({ length: 6 }, (_, index) => ({
  fullName: `awesome/list-${index}`,
  stars: 20000 + index * 5000,
  listness: 70,
  score: 80 - index,
}));

test("audit scores a strong repository as A or better", () => {
  const result = auditRepo(strongRepo, strongReadme, strongGaps, { now: NOW });
  assert.ok(result.score >= 80, `expected >= 80, got ${result.score}`);
  assert.ok(["A", "A+"].includes(result.grade));
  assert.equal(result.dimensions.length, 4);
  assert.equal(result.checks.length, 19);
  assert.equal(result.gaps, 6);
  assert.ok(result.fixes.length <= 5);
});

test("audit gives a weak repository concrete fixes", () => {
  const result = auditRepo(
    { fullName: "someone/stub", name: "stub", stars: 0 },
    "# stub",
    [],
    { now: NOW },
  );
  assert.ok(result.score < 50);
  assert.equal(result.grade, "F");
  assert.ok(result.fixes.length > 0);
  assert.ok(result.fixes.every((fix) => fix.points > 0 && fix.advice));
  assert.ok(result.fixes.some((fix) => ["gaps", "stars", "topics", "description"].includes(fix.id)));
  assert.ok(result.fixes.some((fix) => fix.id === "topics"));
});

test("audit handles empty input without crashing", () => {
  const result = auditRepo({}, "", [], { now: NOW });
  assert.equal(result.repo, "owner/repo");
  assert.equal(result.checks.length, 19);
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
});

test("audit reports agree on the core result", () => {
  const result = auditRepo(strongRepo, strongReadme, strongGaps, { now: NOW });
  const terminal = renderAuditTerminal(result, { color: false });
  const markdown = renderAuditMarkdown(result, { generatedAt: NOW });
  const json = JSON.parse(renderAuditJson(result, { generatedAt: NOW }));

  assert.match(terminal, /acme\/widget/);
  assert.match(terminal, new RegExp(String(result.score)));
  assert.match(markdown, /Score: \d+(?:\.\d+)?\/100/);
  assert.match(markdown, /Top fixes|Distribution gaps/);
  assert.equal(json.repo, result.repo);
  assert.equal(json.score, result.score);
  assert.equal(json.grade, result.grade);
  assert.equal(json.checks.length, 19);
});

test("share badge uses a static Shields.io URL", () => {
  const result = auditRepo(strongRepo, strongReadme, strongGaps, { now: NOW });
  assert.match(result.share.badge, /img\.shields\.io\/badge\/stargap-/);
  assert.match(result.share.badge, new RegExp(encodeURIComponent(`${result.score}/100 ${result.grade}`)));
  assert.doesNotMatch(result.share.badge, /badge\.svg\?repo=/);
});

test("renderBadge returns a valid standalone SVG", () => {
  const result = auditRepo(strongRepo, strongReadme, strongGaps, { now: NOW });
  const svg = renderBadge(result);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /role="img"/);
  assert.match(svg, new RegExp(`${result.score}/100 ${result.grade}`));
  assert.match(svg, new RegExp(gradeColor(result.grade).slice(1)));
  assert.match(svg, /<\/svg>\s*$/);
});