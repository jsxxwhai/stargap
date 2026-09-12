import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("action manifest exposes audit score, badge and quality gate outputs", async () => {
  const action = await read("../action.yml");
  assert.match(action, /^name: stargap$/m);
  assert.match(action, /mode:/);
  assert.match(action, /default: audit/);
  assert.match(action, /badge-output:/);
  assert.match(action, /fail-under:/);
  assert.match(action, /score:/);
  assert.match(action, /grade:/);
  assert.match(action, /bin\/action\.mjs/);
});

test("action runner wires summary, score, grade and badge outputs", async () => {
  const runner = await read("../bin/action.mjs");
  assert.match(runner, /GITHUB_STEP_SUMMARY/);
  assert.match(runner, /GITHUB_OUTPUT/);
  assert.match(runner, /await output\("score"/);
  assert.match(runner, /await output\("grade"/);
  assert.match(runner, /await output\("badge"/);
  assert.match(runner, /renderAuditMarkdown\(audit\)/);
  assert.match(runner, /renderBadge\(audit\)/);
  assert.match(runner, /fail-under/);
  assert.match(runner, /const searchOptions = \{ token \}/);
  assert.match(runner, /loadRepoProfile\(repo, searchOptions\)/);
  assert.match(runner, /searchOptions,/);
});
