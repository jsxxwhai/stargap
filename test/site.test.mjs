import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");
const run = promisify(execFile);

test("browser app script parses as valid ESM", async () => {
  const html = await read("../site/index.html");
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(match, "site/index.html must contain a module script");
  const tmp = fileURLToPath(new URL("../site/index.html", import.meta.url)) + ".check.mjs";
  const { writeFile, rm } = await import("node:fs/promises");
  await writeFile(tmp, match[1], "utf8");
  try {
    await run(process.execPath, ["--check", tmp]);
  } finally {
    await rm(tmp, { force: true });
  }
});

test("README only advertises verified install paths", async () => {
  const readme = await read("../README.md");
  const { version } = JSON.parse(await read("../package.json"));
  assert.doesNotMatch(readme, /npx --yes github:jsxxwhai\/stargap/);
  assert.match(readme, new RegExp(`git clone --depth 1 --branch v${version.replace(/\./g, "\\.")}`));
  assert.match(readme, new RegExp(`archive/refs/tags/v${version.replace(/\./g, "\\.")}\\.tar\\.gz`));
});

test("browser app auto-runs a shared repo link and exposes share controls", async () => {
  const html = await read("../site/index.html");
  assert.match(html, /id="share"/);
  assert.match(html, /id="copy-link"/);
  assert.match(html, /\.share\[hidden\]\{display:none\}/);
  assert.match(html, /requestSubmit\(\)/);
  assert.match(html, /history\.replaceState/);
});

test("a shared ?repo= link runs a full scan in a DOM sandbox", async () => {
  const html = await read("../site/index.html");
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  const { runInNewContext } = await import("node:vm");
  const { auditRepo, gradeColor } = await import("../src/audit.mjs");

  class Element {
    constructor(id) { this.id = id; this.hidden = false; this.value = ""; this.innerHTML = ""; this.textContent = ""; this.href = ""; this.handlers = {}; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
    requestSubmit() { return this.handlers.submit?.({ preventDefault() {} }); }
  }

  const ids = ["output", "form", "repo", "token", "run", "share", "copy-link", "copy-badge", "share-x", "share-hn"];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element(id)]));
  const calls = [];

  const link = (i) => `- [tool ${i}](https://example.com/tool-${i}) - does a thing`;
  let candidateReadme = [
    "# Awesome Python",
    "Curated list of Python resources.",
    "## Linters",
    ...Array.from({ length: 16 }, (_, i) => link(i)),
  ].join("\n");

  const json = (data) => new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes("/repos/astral-sh/ruff")) {
      return json({
        full_name: "astral-sh/ruff",
        name: "ruff",
        html_url: "https://github.com/astral-sh/ruff",
        description: "An extremely fast Python linter",
        topics: ["python", "linter"],
        stargazers_count: 30000,
      });
    }
    if (String(url).includes("/search/repositories")) {
      return json({
        items: [{
          full_name: "awesome/awesome-python",
          description: "Curated list of Python resources",
          topics: ["python"],
          stargazers_count: 5000,
          html_url: "https://github.com/awesome/awesome-rust",
          archived: false,
          fork: false,
        }],
      });
    }
    if (String(url).includes("raw.githubusercontent.com/awesome/awesome-python")) return new Response(candidateReadme, { status: 200 });
    if (String(url).includes("raw.githubusercontent.com/astral-sh/ruff")) return new Response("# ruff\nA Python linter.", { status: 200 });
    return new Response("not found", { status: 404 });
  };

  const context = {
    document: { getElementById: (id) => elements[id] ?? null },
    location: { origin: "https://jsxxwhai.github.io", pathname: "/stargap/", search: "?repo=astral-sh/ruff" },
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: async () => {} } },
    fetch: fetchImpl,
    Response,
    URLSearchParams,
    encodeURIComponent,
    setTimeout,
    console,
    __audit: { auditRepo, gradeColor },
  };

  const browserScript = match[1].replace(/^import .*?;$/m, "const { auditRepo, gradeColor } = globalThis.__audit;");
  runInNewContext(browserScript, context);
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(calls.some((url) => url.includes("/search/repositories")), "shared link should trigger a GitHub search");
  assert.equal(elements.share.hidden, false, "share controls should be revealed after a successful scan");
  assert.match(elements.output.innerHTML, /awesome\/awesome-python/);

  // A perfect score with no gaps must still expose the share and badge controls.
  candidateReadme = "# Awesome Python\nCurated list of Python resources.\n## Linters\nhttps://github.com/astral-sh/ruff";
  await elements.form.requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.match(elements.output.innerHTML, /No confirmed high-star list gaps/);
  assert.equal(elements.share.hidden, false, "share controls should also work when no gaps are found");
  assert.equal(typeof elements["copy-badge"].onclick, "function", "badge copy should be wired when no gaps are found");
});

test("GitHub Action publishes an audit report and quality-gate outputs", async () => {
  const action = await read("../action.yml");
  assert.match(action, /default: audit/);
  assert.match(action, /badge-output:/);
  assert.match(action, /fail-under:/);
  assert.match(action, /bin\/action\.mjs/);
  const runner = await read("../bin/action.mjs");
  assert.match(runner, /GITHUB_STEP_SUMMARY/);
  assert.match(runner, /renderAuditMarkdown\(audit\)/);
});
