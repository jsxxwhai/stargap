#!/usr/bin/env node
/**
 * stargap — find the high-star GitHub awesome-lists that should mention your project but don't.
 *
 * Zero dependencies. Node 18+.
 */

import { parseArgs } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { loadRepoProfile, findGaps } from "../src/scan.mjs";
import { renderJson, renderMarkdown, renderTerminal } from "../src/report.mjs";
import { rateLimit } from "../src/github.mjs";
import { cacheDir, createCache } from "../src/cache.mjs";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const VERSION = packageJson.version;

const HELP = `stargap ${VERSION} — find the high-star GitHub awesome-lists that should mention you

Usage
  stargap <owner/repo> [options]
  stargap <owner/repo> --markdown --out GAPS.md
  stargap <owner/repo> --json
  stargap doctor
  stargap cache

Options
  --query <q>        Override the auto-generated GitHub search query
  --min-stars <n>    Ignore repos below this star count (default: 100)
  --limit <n>        Max gaps to report (default: 20)
  --candidates <n>   Max search hits to inspect (default: 40)
  --markdown         Output a Markdown report
  --json             Output JSON
  --out <file>       Write output to a file instead of stdout
  --token <token>    GitHub token (or set GITHUB_TOKEN / GH_TOKEN)
  --no-cache         Bypass the on-disk cache
  --quiet            Suppress progress messages
  -h, --help         Show this help
  -v, --version      Show version

Why a token?
  Unauthenticated GitHub allows 60 requests/hour. A full scan uses far more
  than that, so set GITHUB_TOKEN (a classic token with no scopes is enough).

Examples
  npx stargap acme/widget
  stargap acme/widget --min-stars 500 --limit 10
  stargap acme/widget --query "awesome in:name cli" --markdown --out GAPS.md
`;

function parse(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      query: { type: "string" },
      "min-stars": { type: "string" },
      limit: { type: "string" },
      candidates: { type: "string" },
      markdown: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      out: { type: "string" },
      token: { type: "string" },
      "no-cache": { type: "boolean", default: false },
      quiet: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
  return { values, positionals };
}

function toInt(value, fallback, name) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a non-negative integer, got "${value}"`);
  }
  return parsed;
}

async function main(argv) {
  const { values, positionals } = parse(argv);

  if (values.version) {
    console.log(VERSION);
    return 0;
  }
  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return values.help ? 0 : 1;
  }

  const token = values.token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
  const cache = createCache({ enabled: !values["no-cache"] });
  const searchOptions = { token, cache };

  if (positionals[0] === "doctor") {
    const limits = await rateLimit(searchOptions);
    const core = limits.resources?.core;
    const search = limits.resources?.search;
    console.log(`token:  ${token ? "yes" : "no (60 req/h; set GITHUB_TOKEN for 5000)"}`);
    console.log(`core:   ${core ? `${core.remaining}/${core.limit}` : "unknown"}`);
    console.log(`search: ${search ? `${search.remaining}/${search.limit}` : "unknown"}`);
    console.log(`cache:  ${cacheDir()}`);
    return 0;
  }

  if (positionals[0] === "cache") {
    const { rm } = await import("node:fs/promises");
    await rm(cacheDir(), { recursive: true, force: true });
    console.log(`cleared ${cacheDir()}`);
    return 0;
  }

  const fullName = positionals[0];
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) {
    throw new Error(`expected <owner/repo>, got "${fullName}"`);
  }

  const progress = values.quiet ? () => {} : (message) => console.error(`· ${message}`);

  progress(`loading ${fullName}`);
  const profile = await loadRepoProfile(fullName, searchOptions);
  progress(`extracted ${profile.keywords.length} keywords`);

  const gaps = await findGaps(profile, {
    query: values.query,
    minStars: toInt(values["min-stars"], 100, "min-stars"),
    limit: toInt(values.limit, 20, "limit"),
    candidates: toInt(values.candidates, 40, "candidates"),
    searchOptions,
    onProgress: progress,
  });

  profile.query = values.query ?? null;

  const output = values.json
    ? renderJson(profile, gaps)
    : values.markdown
      ? renderMarkdown(profile, gaps)
      : renderTerminal(profile, gaps);

  if (values.out) {
    await writeFile(values.out, output + "\n", "utf8");
    progress(`wrote ${values.out}`);
  } else {
    console.log(output);
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`stargap: ${error.message}`);
    if (process.env.STARGAP_DEBUG) console.error(error.stack);
    process.exitCode = 1;
  });
