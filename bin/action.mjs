#!/usr/bin/env node
/**
 * GitHub Action runner for stargap.
 *
 * One process fetches the repository and candidate lists once, then writes
 * the report, score, badge and job summary.
 */

import { appendFile, writeFile } from "node:fs/promises";
import { auditRepo, renderBadge } from "../src/audit.mjs";
import { renderAuditMarkdown, renderMarkdown } from "../src/report.mjs";
import { findGaps, loadRepoProfile } from "../src/scan.mjs";

const env = (name, fallback = "") => process.env[name] ?? fallback;

function integer(name, fallback) {
  const raw = env(name).trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

async function output(name, value) {
  const path = env("GITHUB_OUTPUT").trim();
  if (!path) return;
  const safe = String(value).replace(/\r?\n/g, "%0A");
  await appendFile(path, `${name}=${safe}\n`, "utf8");
}

async function summary(markdown) {
  const path = env("GITHUB_STEP_SUMMARY").trim();
  if (!path) return;
  await appendFile(path, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");
}

async function main() {
  const repo = env("INPUT_REPO", env("GITHUB_REPOSITORY")).trim();
  const mode = env("INPUT_MODE", "audit").trim().toLowerCase();
  const outputPath = env("INPUT_OUTPUT", "stargap-report.md").trim();
  const badgePath = env("INPUT_BADGE_OUTPUT").trim();
  const token = env("INPUT_TOKEN", env("GITHUB_TOKEN"));
  const minStars = integer("INPUT_MIN_STARS", 1000);
  const limit = integer("INPUT_LIMIT", 20);
  const candidates = integer("INPUT_CANDIDATES", 40);
  const failUnder = env("INPUT_FAIL_UNDER").trim();

  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error(`repo must be owner/name, got "${repo}"`);
  }
  if (mode !== "audit" && mode !== "gaps") {
    throw new Error(`mode must be audit or gaps, got "${mode}"`);
  }

  const searchOptions = { token };
  const profile = await loadRepoProfile(repo, searchOptions);
  const gaps = await findGaps(profile, {
    searchOptions,
    query: env("INPUT_QUERY").trim() || undefined,
    minStars,
    limit,
    candidates,
    onProgress: (message) => console.error(`· ${message}`),
  });

  let report;
  let audit = null;
  if (mode === "audit") {
    audit = auditRepo(profile, profile.readme, gaps);
    report = renderAuditMarkdown(audit);
  } else {
    report = renderMarkdown(profile, gaps);
  }

  await writeFile(outputPath, report.endsWith("\n") ? report : `${report}\n`, "utf8");
  await summary(report);
  await output("report", outputPath);
  await output("score", audit ? audit.score : "");
  await output("grade", audit ? audit.grade : "");

  if (badgePath) {
    if (!audit) throw new Error("badge-output is only available in audit mode");
    await writeFile(badgePath, renderBadge(audit), "utf8");
    await output("badge", badgePath);
  }

  if (failUnder) {
    const threshold = Number(failUnder);
    if (!Number.isFinite(threshold)) {
      throw new Error(`fail-under must be a number, got "${failUnder}"`);
    }
    if (!audit) throw new Error("fail-under is only available in audit mode");
    if (audit.score < threshold) {
      console.error(`stargap score ${audit.score} is below fail-under ${threshold}`);
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
