/**
 * Core pipeline: profile a repo, find high-star curated lists that omit it,
 * and rank the gaps by how much traffic they could plausibly send.
 */

import { fetchRepo, isRateLimited, rateLimitHint, searchRepositories } from "./github.mjs";
import { isGenericTerm } from "./generic.mjs";
import { domainEvidence } from "./domain.mjs";
import { fetchReadme } from "./readme.mjs";
import { analyzeReadme } from "./match.mjs";
import {
  extractKeywords,
  gapScore,
  idfFrom,
  isRelevantMatch,
  listness,
  mentionOf,
  relevance,
  suggestEntry,
} from "./keywords.mjs";

/**
 * Build a keyword profile for a repository.
 *
 * @param {{ fullName: string, name?: string, description?: string, topics?: string[], readme?: string }} input
 */
export function profileRepo(input) {
  const name = input.name ?? (input.fullName ?? "").split("/").pop() ?? "";
  const description = input.description ?? "";
  const topics = input.topics ?? [];
  const readme = input.readme ?? "";
  return {
    fullName: input.fullName,
    name,
    owner: (input.fullName ?? "").split("/")[0] ?? "",
    description,
    topics,
    readme,
    url: input.url ?? `https://github.com/${input.fullName}`,
    homepage: input.homepage ?? "",
    license: input.license ?? null,
    stars: input.stars ?? 0,
    pushedAt: input.pushedAt ?? null,
    updatedAt: input.updatedAt ?? null,
    // Full set, including README prose — used for ranking candidate lists.
    keywords: extractKeywords({ name, description, topics, readme }),
    // Declared identity: what the maintainer explicitly declares the project
    // to be. Topics and the repo name only — description prose leaks verbs
    // like "do" and "want", and README prose leaks generic nouns like
    // "tools", both of which match unrelated sections. Falls back to the
    // description when a repo declares no topics at all.
    identityKeywords:
      topics.length > 0
        ? extractKeywords({ name, topics })
        : extractKeywords({ name, description, topics }),
  };
}

/** Fetch a repo's metadata + README and build a profile. */
export async function loadRepoProfile(fullName, options = {}) {
  const repo = await fetchRepo(fullName, options);
  const readme = await fetchReadme(fullName, options);
  return profileRepo({
    fullName: repo.fullName,
    name: repo.name ?? repo.fullName.split("/").pop(),
    description: repo.description ?? "",
    topics: repo.topics ?? [],
    readme: readme ?? "",
    url: repo.url,
    homepage: repo.homepage ?? "",
    license: repo.license ?? null,
    stars: repo.stars ?? 0,
    pushedAt: repo.pushedAt ?? null,
    updatedAt: repo.updatedAt ?? null,
  });
}

/** Strongest ASCII keywords, deduplicated. */
export function topKeywords(profile, limit = 6) {
  const seen = new Set();
  const result = [];
  for (const { keyword } of profile.keywords ?? []) {
    if (keyword.length < 3) continue;
    if (!/^[a-z0-9-]+$/.test(keyword)) continue;
    if (seen.has(keyword)) continue;
    seen.add(keyword);
    result.push(keyword);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Turn a profile into focused GitHub search queries.
 *
 * Maintainer-curated topics are the strongest signal of what a project *is*,
 * so they come first. GitHub treats bare terms as AND, so each query stays
 * narrow instead of combining everything into one query that matches nothing.
 */
export function buildSearchQueries(profile, { limit = 4 } = {}) {
  const selfNames = new Set(
    [profile.name, ...(profile.fullName ?? "").split("/")]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
  );
  const topics = (profile.topics ?? [])
    .map((topic) => String(topic).toLowerCase().trim())
    .filter((topic) => /^[a-z0-9-]+$/.test(topic) && topic.length >= 3)
    // "awesome" and "awesome-list" describe the list format, not the topic,
    // so "awesome awesome" is a wasted query.
    .filter((topic) => topic !== "awesome" && topic !== "awesome-list" && !isGenericTerm(topic))
    // No curated list is "about" your own project — you want lists about the
    // category you belong to. "awesome chdb" finds nothing useful.
    .filter((topic) => !selfNames.has(topic) && ![...selfNames].some((self) => topic.includes(self)));
  // `awesome in:name <topic>` is dramatically more precise than `awesome
  // <topic>`: without the qualifier GitHub matches the topic anywhere in a
  // README, so "awesome clickhouse" returns unrelated high-star repos.
  const queries = [];
  const add = (term) => {
    if (queries.length >= limit) return;
    if (selfNames.has(term) || [...selfNames].some((self) => term.includes(self))) return;
    const query = `awesome in:name ${term}`;
    if (!queries.includes(query)) queries.push(query);
  };
  for (const topic of topics) add(topic);
  for (const keyword of topKeywords(profile, limit)) add(keyword);
  if (!queries.length && profile.name) queries.push(`awesome in:name ${profile.name}`);
  return queries;
}

/** Backwards-compatible single-query helper (used in docs/tests). */
export function buildSearchQuery(profile, options = {}) {
  return buildSearchQueries(profile, options).join(" OR ");
}

/**
 * Find candidate repos that might list the target but do not mention it yet.
 *
 * @param {ReturnType<typeof profileRepo>} profile
 * @param {object} [options]
 * @param {number} [options.limit] Max gaps to report.
 * @param {number} [options.minStars] Ignore repos below this star count.
 * @param {number} [options.candidates] How many search hits to inspect.
 * @param {number} [options.perPage] Results per search query.
 * @param {string[]} [options.queries] Override the generated queries.
 * @param {(msg: string) => void} [options.onProgress]
 */
export async function findGaps(profile, options = {}) {
  const {
    limit = 20,
    minStars = 100,
    candidates = 40,
    perPage = 15,
    maxQueries = 4,
    searchOptions = {},
    onProgress = () => {},
    search = searchRepositories,
    readme = fetchReadme,
  } = options;

  const queries = options.queries ?? options.query ?? buildSearchQueries(profile, { limit: maxQueries });
  // A user-supplied --query is a literal GitHub query, not a list of
  // alternatives. Generated queries are already an array of focused searches.
  const queryList = Array.isArray(queries) ? queries : [queries];

  const found = new Map();
  for (const query of queryList) {
    onProgress(`searching GitHub: ${query}`);
    let results = [];
    try {
      results = await search(query, { perPage, maxPages: 1, ...searchOptions });
    } catch (error) {
      if (isRateLimited(error)) {
        throw new Error(rateLimitHint(error) ?? error.message);
      }
      onProgress(`  search failed: ${error.message}`);
      continue;
    }
    for (const repo of results) {
      if (!found.has(repo.fullName)) found.set(repo.fullName, repo);
    }
  }

  const pool = [...found.values()].sort((a, b) => b.stars - a.stars);
  const idf = idfFrom(pool, profile.keywords);

  const seen = new Set();
  const ranked = [];
  let inspected = 0;

  for (const repo of pool) {
    if (inspected >= candidates) break;
    if (seen.has(repo.fullName) || repo.fullName === profile.fullName) continue;
    seen.add(repo.fullName);
    if (repo.archived || repo.isFork) continue;
    if (repo.stars < minStars) continue;

    const listnessScore = listness(repo);
    if (listnessScore < 15) continue;

    // Broad relevance is used for ranking only. The hard gate is the section
    // match below, which is precise: a project with many topics can never
    // score high on a normalized relevance ratio, yet a single exact section
    // match is exactly what we want.
    const relevanceScore = relevance(profile.keywords, repo, { idf });
    if (!isRelevantMatch(profile.keywords, repo, { idf })) continue;

    inspected += 1;
    onProgress(`checking ${repo.fullName} (${repo.stars} stars)`);

    let readmeText = null;
    try {
      readmeText = await readme(repo.fullName, searchOptions);
    } catch (error) {
      if (isRateLimited(error)) {
        throw new Error(rateLimitHint(error) ?? error.message);
      }
      onProgress(`  skipped ${repo.fullName}: ${error.message}`);
      continue;
    }

    const mention = mentionOf(readmeText ?? "", profile);
    if (mention) continue;

    const analysis = analyzeReadme(readmeText ?? "", profile.identityKeywords, {
      idf,
      repoName: repo.fullName.split("/").pop(),
    });
    // A candidate must read as a curated list AND contain a genuine topic
    // section matching the project. Otherwise "awesome-mac" shows up as a gap
    // for a Python library, which is noise.
    if (!analysis.isList) continue;
    if (!analysis.matchedSections.length) continue;

    // A section heading must also belong to the candidate list's own declared
    // subject. Otherwise a JavaScript list can be reported as a "Transpilers"
    // gap for a Python linter simply because one word collides.
    const domain = domainEvidence(profile.identityKeywords, repo, { idf });
    if (!domain.ok) {
      onProgress(`  skipped ${repo.fullName}: ${domain.reason}`);
      continue;
    }

    // A confirmed section match is the strongest possible relevance signal.
    const matchScore = Math.max(relevanceScore, analysis.bestSection?.score ?? 0);

    ranked.push({
      fullName: repo.fullName,
      stars: repo.stars,
      description: repo.description,
      url: repo.url,
      topics: repo.topics,
      pushedAt: repo.pushedAt,
      listness: listnessScore,
      relevance: matchScore,
      sectionCount: analysis.matchedSections.length,
      score: gapScore({ stars: repo.stars, listnessScore, relevanceScore: matchScore }),
      reason: describeReason(repo, listnessScore, matchScore, analysis, domain),
      section: analysis.bestSection?.heading ?? null,
      domainEvidence: domain.reason,
      entry: suggestEntry(profile),
    });
  }

  ranked.sort((a, b) => b.score - a.score || b.stars - a.stars);
  return ranked.slice(0, limit);
}

function describeReason(repo, listnessScore, relevanceScore, analysis, domain) {
  const parts = [];
  if (listnessScore >= 60) parts.push("curated list");
  else if (listnessScore >= 25) parts.push("collection");
  if (analysis?.bestSection) parts.push(`section: ${analysis.bestSection.heading}`);
  if (domain?.overlap?.length) parts.push(`subject: ${domain.overlap.slice(0, 3).join(", ")}`);
  if (relevanceScore >= 50) parts.push("strong topic overlap");
  else if (relevanceScore >= 25) parts.push("topic overlap");
  parts.push(`${repo.stars.toLocaleString("en-US")} stars`);
  return parts.join(", ");
}












