import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeReadme,
  cleanHeading,
  findMatchingTokens,
  isAsciiToken,
  isTopicHeading,
  tokenMatches,
  tokenParts,
  tokenizeHeading,
} from "../src/match.mjs";
import { isGenericTerm } from "../src/generic.mjs";

test("tokenMatches is exact-first and CJK-safe", () => {
  assert.ok(tokenMatches("vector", "vector"));
  assert.ok(tokenMatches("vector", "vector-database"));
  assert.ok(!tokenMatches("pip", "pipeline和nlp模型通过同义词替换实现文本"));
  assert.ok(!tokenMatches("in", "linux"));
  assert.ok(!tokenMatches("linux", "in"));
  assert.ok(!tokenMatches("py", "python"));
});

test("isAsciiToken rejects CJK and mixed tokens", () => {
  assert.ok(isAsciiToken("vector-db"));
  assert.ok(!isAsciiToken("中文"));
  assert.ok(!isAsciiToken("pipeline和nlp"));
});

test("tokenParts splits compounds", () => {
  assert.deepEqual(tokenParts("python-tools"), ["python", "tools"]);
  assert.deepEqual(tokenParts("embedded-database"), ["embedded", "database"]);
});

test("generic list prose is recognized", () => {
  for (const term of ["tools", "libraries", "awesome", "resources", "frameworks"]) {
    assert.ok(isGenericTerm(term), `${term} should be generic`);
  }
  assert.ok(!isGenericTerm("clickhouse"));
  assert.ok(!isGenericTerm("ruff"));
});

test("compound keywords never match on their generic head noun alone", () => {
  // The bug: every list has a "Tools" section, so "python-tools" matched it.
  assert.ok(!tokenMatches("python-tools", "tools"));
  assert.ok(!tokenMatches("python-libraries", "libraries"));
  assert.ok(!tokenMatches("embedded-database", "database"));
  // But the qualified form does match.
  assert.ok(tokenMatches("python-tools", "python"));
  assert.ok(tokenMatches("embedded-database", "embedded-database"));
});

test("section matching requires full coverage of the specific parts", () => {
  const match = (keyword, heading) => findMatchingTokens(keyword, new Set(tokenizeHeading(heading))).length > 0;

  // Bugs seen in real scans: a shared head noun ("analysis") or a shared
  // qualifier ("static") is not enough.
  assert.ok(!match("static-analysis", "Spatial Analysis"));
  assert.ok(!match("static-analysis", "Code Analysis"));
  assert.ok(!match("static-analysis", "Static Site Generator"));
  assert.ok(!match("vector-database", "Spatial Analysis"));
  assert.ok(!match("python-tools", "Tools"));

  // Correct matches.
  assert.ok(match("static-analysis", "Static Analysis"));
  assert.ok(match("python-tools", "Python Tools"));
  assert.ok(match("python-libraries", "Python Libraries"));
  assert.ok(match("vector-database", "Vector Databases"));
  assert.ok(match("embedded-database", "Embedded Databases"));
  assert.ok(match("awesome-python", "Python"));
  assert.ok(match("awesome-functional-python", "Awesome Functional Python"));
});

test("findMatchingTokens only returns real matches", () => {
  const tokens = new Set(["python", "vector-database", "pipeline和nlp模型"]);
  assert.deepEqual(findMatchingTokens("vector", tokens), ["vector-database"]);
  assert.deepEqual(findMatchingTokens("pip", tokens), []);
});

test("isTopicHeading rejects navigation and CTA headings", () => {
  assert.ok(isTopicHeading("Vector databases"));
  assert.ok(isTopicHeading("Package Management"));
  assert.ok(!isTopicHeading("Contents"));
  assert.ok(!isTopicHeading("Table of Contents"));
  assert.ok(!isTopicHeading("🚀 Run one now"));
  assert.ok(!isTopicHeading("License"));
  assert.ok(!isTopicHeading("How to contribute to this project today"));
});

test("non-entry sections are rejected", () => {
  assert.ok(!isTopicHeading("Most common Node Interview Topics & Questions"));
  assert.ok(!isTopicHeading("JavaScript References"));
  assert.ok(!isTopicHeading("Articles & Tutorials"));
  assert.ok(!isTopicHeading("Awesome JavaScript Lists"));
  assert.ok(isTopicHeading("Transpilers"));
  assert.ok(isTopicHeading("NPM"));
  assert.ok(isTopicHeading("Package Managers"));
});

test("cleanHeading strips markdown links and their URLs", () => {
  // The bug: a heading linking to python.langchain.com looked like "Python".
  const cleaned = cleanHeading(":star: [Langchain Data Analyst](https://python.langchain.com/docs/tools)");
  assert.ok(!cleaned.toLowerCase().includes("python"));
  assert.ok(!cleaned.includes("http"));
});

test("analyzeReadme ignores non-topic headings when matching sections", () => {
  const readme = [
    "# Awesome stuff",
    "## Contents",
    "## 🚀 Run one now",
    "## Vector databases",
    ...Array.from({ length: 20 }, (_, i) => `- [Tool ${i}](https://github.com/x/t${i}) - thing`),
  ].join("\n");
  const analysis = analyzeReadme(readme, [{ keyword: "vector", score: 10 }], { idf: () => 1 });
  assert.equal(analysis.matchedSections.length, 1);
  assert.equal(analysis.bestSection.heading, "Vector databases");
});

test("analyzeReadme treats prose as not-a-list", () => {
  const analysis = analyzeReadme("# My project\n\nA vector database for embeddings.", [{ keyword: "vector", score: 10 }], { idf: () => 1 });
  assert.equal(analysis.isList, false);
});


test("a list own title is not treated as a topic section", () => {
  const readme = [
    "# Awesome Functional Python",
    "## Awesome Functional Python",
    "### Books",
    ...Array.from({ length: 20 }, (_, i) => `- [Book ${i}](https://github.com/x/b${i}) - thing`),
  ].join("\n");
  const analysis = analyzeReadme(
    readme,
    [{ keyword: "awesome-functional-python", score: 10 }],
    { idf: () => 1, repoName: "awesome-functional-python" },
  );
  assert.deepEqual(analysis.matchedSections, []);
});

test("a genuine topic section is still matched when a self title exists", () => {
  const readme = [
    "# Awesome Python",
    "## Awesome Python",
    "## Static Analysis",
    ...Array.from({ length: 20 }, (_, i) => `- [Tool ${i}](https://github.com/x/t${i}) - thing`),
  ].join("\n");
  const analysis = analyzeReadme(
    readme,
    [{ keyword: "static-analysis", score: 10 }],
    { idf: () => 1, repoName: "awesome-python" },
  );
  assert.equal(analysis.matchedSections.length, 1);
  assert.equal(analysis.bestSection.heading, "Static Analysis");
});
test("bare category keywords do not match unrelated sections", () => {
  const readme = [
    "# Awesome CLI frameworks",
    "## Useful awesome list for Dotnet cli",
    ...Array.from({ length: 20 }, (_, i) => `- [Tool ${i}](https://github.com/x/t${i}) - thing`),
  ].join("\n");
  const analysis = analyzeReadme(
    readme,
    [{ keyword: "cli", score: 10 }],
    { idf: () => 1, repoName: "awesome-cli-frameworks" },
  );
  assert.deepEqual(analysis.matchedSections, []);
});

test("a specific compound still matches its qualified section", () => {
  const readme = [
    "# Awesome CLI frameworks",
    "## CLI Frameworks",
    ...Array.from({ length: 20 }, (_, i) => `- [Tool ${i}](https://github.com/x/t${i}) - thing`),
  ].join("\n");
  const analysis = analyzeReadme(
    readme,
    [{ keyword: "cli-frameworks", score: 10 }],
    { idf: () => 1, repoName: "awesome-python" },
  );
  assert.equal(analysis.matchedSections.length, 1);
  assert.equal(analysis.bestSection.heading, "CLI Frameworks");
});