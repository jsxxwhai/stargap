import { test } from "node:test";
import assert from "node:assert/strict";
import { createCache } from "../src/cache.mjs";
import { GitHubError, fetchRepo, githubJson, isRateLimited, normalizeRepo, rateLimit, rateLimitHint } from "../src/github.mjs";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("cache round-trips values and expires entries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stargap-cache-"));
  try {
    let now = 1000;
    const cache = createCache({ dir, ttlMs: 100, now: () => now });
    assert.equal(await cache.get("k"), null);
    await cache.set("k", { hello: "world" });
    assert.deepEqual(await cache.get("k"), { hello: "world" });

    // A fresh instance must read the same file back from disk.
    const reopened = createCache({ dir, ttlMs: 100, now: () => now });
    assert.deepEqual(await reopened.get("k"), { hello: "world" });

    now = 5000;
    assert.equal(await reopened.get("k"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("disabled cache never stores anything", async () => {
  const cache = createCache({ enabled: false });
  await cache.set("k", 1);
  assert.equal(await cache.get("k"), null);
});

test("cache treats corrupt entries as misses", async () => {
  const dir = await mkdtemp(join(tmpdir(), "stargap-cache-"));
  try {
    const cache = createCache({ dir });
    await cache.set("k", "v");
    const { readdir, writeFile } = await import("node:fs/promises");
    const [file] = await readdir(dir);
    await writeFile(join(dir, file), "{not json", "utf8");
    const fresh = createCache({ dir });
    assert.equal(await fresh.get("k"), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("githubJson returns parsed data on success", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  const { data } = await githubJson("/rate_limit", { fetchImpl, cache: createCache({ enabled: false }), retries: 0 });
  assert.equal(data.ok, true);
});

test("githubJson retries server errors then succeeds", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  const { data } = await githubJson("/x", { fetchImpl, cache: createCache({ enabled: false }), retries: 2 });
  assert.equal(data.ok, true);
  assert.equal(calls, 2);
});

test("githubJson surfaces rate limits instead of silently skipping", async () => {
  const fetchImpl = async () =>
    new Response("API rate limit exceeded", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      },
    });
  await assert.rejects(
    () => githubJson("/repos/x/y", { fetchImpl, cache: createCache({ enabled: false }), retries: 1 }),
    (error) => {
      assert.ok(error instanceof GitHubError);
      assert.ok(isRateLimited(error));
      assert.match(rateLimitHint(error), /GITHUB_TOKEN/);
      return true;
    },
  );
});

test("githubJson does not retry 404", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response("not found", { status: 404 });
  };
  await assert.rejects(
    () => githubJson("/repos/x/y", { fetchImpl, cache: createCache({ enabled: false }), retries: 3 }),
    (error) => error.status === 404,
  );
  assert.equal(calls, 1);
});

test("normalizeRepo fills defaults", () => {
  const repo = normalizeRepo({ full_name: "a/b", stargazers_count: 5, html_url: "u" });
  assert.equal(repo.fullName, "a/b");
  assert.equal(repo.stars, 5);
  assert.deepEqual(repo.topics, []);
  assert.equal(repo.archived, false);
  assert.equal(repo.isFork, false);
});

test("fetchRepo falls back to search when the core quota is exhausted", async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes("/search/repositories")) {
      return new Response(
        JSON.stringify({ items: [{ full_name: "a/b", stargazers_count: 9, html_url: "u", topics: ["x"] }] }),
        { status: 200 },
      );
    }
    return new Response("rate limited", {
      status: 403,
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      },
    });
  };
  const repo = await fetchRepo("a/b", { fetchImpl, cache: createCache({ enabled: false }), retries: 0 });
  assert.equal(repo.fullName, "a/b");
  assert.equal(repo.stars, 9);
});

test("rateLimit never serves a cached budget", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ resources: { core: { remaining: 60 - calls, limit: 60 } } }), { status: 200 });
  };
  const cache = createCache({ enabled: false });
  const first = await rateLimit({ fetchImpl, cache });
  const second = await rateLimit({ fetchImpl, cache });
  assert.equal(first.resources.core.remaining, 59);
  assert.equal(second.resources.core.remaining, 58);
  assert.equal(calls, 2);
});
test("CLI version stays in sync with package.json", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("../bin/stargap.mjs", import.meta.url)),
    "--version",
  ]);
  assert.equal(stdout.trim(), packageJson.version);
});
