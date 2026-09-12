import { test } from "node:test";
import assert from "node:assert/strict";
import { extractKeywords, gapScore, listness, mentionOf, relevance, suggestEntry, tokenize } from "../src/keywords.mjs";
import { buildSearchQuery, findGaps, profileRepo } from "../src/scan.mjs";
import { renderJson, renderMarkdown, renderTerminal } from "../src/report.mjs";

test("tokenize lowercases and splits", () => {
  assert.deepEqual(tokenize("Fast, Local-first RAG!"), ["fast", "local-first", "rag"]);
  assert.deepEqual(tokenize(""), []);
  assert.deepEqual(tokenize(undefined), []);
});

test("extractKeywords weights topics and headings above body text", () => {
  const keywords = extractKeywords({
    name: "vecdb",
    description: "A tiny vector database",
    topics: ["vector-database"],
    readme: "# Vector Database\n\nA vector database for embeddings.\n\n" + "filler ".repeat(2000) + "\n## Embeddings\n",
  });
  const byName = Object.fromEntries(keywords.map((k) => [k.keyword, k.score]));
  assert.ok(byName["vector-database"] > 0, "topic kept as phrase");
  assert.ok(byName.vector > byName.filler, "topic terms outrank body filler");
  assert.ok(keywords.length > 0);
});

test("listness detects awesome lists and comparison repos", () => {
  assert.ok(listness({ fullName: "x/awesome-cli", description: "A curated list of CLI tools" }) >= 60);
  assert.ok(listness({ fullName: "x/cli-alternatives", description: "Comparison of CLI tools" }) >= 15);
  assert.equal(listness({ fullName: "x/vec", description: "A vector database" }), 0);
});

test("mentionOf finds an existing entry", () => {
  const readme = "## Tools\n- [Other](https://github.com/o/other)\n- [VecDB](https://github.com/acme/vecdb) - a vector db\n";
  const mention = mentionOf(readme, { fullName: "acme/vecdb", name: "vecdb", url: "https://github.com/acme/vecdb" });
  assert.ok(mention);
  assert.match(mention.line, /VecDB/);
  assert.equal(mentionOf(readme, { fullName: "acme/other", name: "other", url: "https://github.com/acme/other" }), null);
});

test("relevance rises when repo text matches keywords", () => {
  const keywords = extractKeywords({ name: "vecdb", description: "vector database", topics: ["vector-database"] });
  const close = relevance(keywords, { fullName: "x/vector-tools", description: "vector database tools", topics: ["vector-database"] });
  const far = relevance(keywords, { fullName: "x/recipes", description: "cooking recipes", topics: ["food"] });
  assert.ok(close > far);
  assert.ok(close >= 40);
});

test("gapScore rewards stars, listness and relevance", () => {
  const low = gapScore({ stars: 100, listnessScore: 20, relevanceScore: 20 });
  const high = gapScore({ stars: 20000, listnessScore: 80, relevanceScore: 80 });
  assert.ok(high > low);
  assert.ok(high <= 100 && low >= 0);
});

test("suggestEntry produces a Markdown bullet", () => {
  const entry = suggestEntry({ name: "vecdb", url: "https://github.com/acme/vecdb", description: "A tiny vector database" });
  assert.equal(entry, "- [vecdb](https://github.com/acme/vecdb) - A tiny vector database");
});

test("buildSearchQuery uses ASCII keywords plus list hints", () => {
  const profile = profileRepo({ fullName: "acme/vecdb", description: "vector database", topics: ["vector-database"] });
  const query = buildSearchQuery(profile);
  assert.match(query, /vector/);
  assert.match(query, /awesome/);
});

test("findGaps filters out repos that already mention the target", async () => {
  const profile = profileRepo({ fullName: "acme/vecdb", description: "vector database", topics: ["vector-database"] });
  const repos = [
    { fullName: "good/awesome-vector", stars: 900, description: "curated list of vector databases", url: "https://github.com/good/awesome-vector", topics: ["vector-database"], pushedAt: null, archived: false, isFork: false },
    { fullName: "seen/awesome-vector", stars: 800, description: "curated list of vector databases", url: "https://github.com/seen/awesome-vector", topics: ["vector-database"], pushedAt: null, archived: false, isFork: false },
    { fullName: "tiny/awesome-vector", stars: 5, description: "curated list", url: "https://github.com/tiny/awesome-vector", topics: ["vector-database"], pushedAt: null, archived: false, isFork: false },
    { fullName: "acme/vecdb", stars: 50, description: "vector database", url: "https://github.com/acme/vecdb", topics: ["vector-database"], pushedAt: null, archived: false, isFork: false },
  ];
  const entries = (extra) =>
    [
      "# Awesome vector",
      "## Vector databases",
      ...Array.from({ length: 20 }, (_, i) => `- [Tool ${i}](https://github.com/x/t${i}) - thing`),
      extra,
    ]
      .filter(Boolean)
      .join("\n");
  const readmes = {
    "good/awesome-vector": entries(),
    "seen/awesome-vector": entries("- [VecDB](https://github.com/acme/vecdb) - a vector db"),
  };
  const gaps = await findGaps(profile, {
    search: async () => repos,
    readme: async (fullName) => readmes[fullName] ?? null,
    minStars: 100,
    candidates: 10,
    onProgress: () => {},
  });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].fullName, "good/awesome-vector");
  assert.match(gaps[0].entry, /acme\/vecdb/);
});

test("renderers include the repo and gap", () => {
  const profile = profileRepo({ fullName: "acme/vecdb", description: "vector database", topics: ["vector-database"] });
  const gaps = [{ fullName: "good/awesome-vector", stars: 900, description: "curated list", url: "https://github.com/good/awesome-vector", topics: [], listness: 70, relevance: 60, score: 80, reason: "curated list, 900 stars", entry: "- [vecdb](https://github.com/acme/vecdb) - vector database" }];
  assert.match(renderTerminal(profile, gaps, { color: false }), /good\/awesome-vector/);
  assert.match(renderMarkdown(profile, gaps, { generatedAt: new Date("2026-01-01T00:00:00Z") }), /\| 1 \| \[good\/awesome-vector\]/);
  const json = JSON.parse(renderJson(profile, gaps, { generatedAt: new Date("2026-01-01T00:00:00Z") }));
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.gaps[0].fullName, "good/awesome-vector");
});

