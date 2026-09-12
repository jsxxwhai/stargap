/** Keyword extraction + matching helpers. Pure functions, easy to test. */
import { findMatchingTokens } from "./match.mjs";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "to", "of", "in", "on", "with", "is", "are",
  "that", "this", "it", "as", "by", "from", "your", "you", "our", "we", "be", "can",
  "will", "not", "no", "but", "if", "then", "than", "so", "at", "into", "about",
  "using", "use", "used", "uses", "via", "all", "any", "more", "most", "other",
  "open", "source", "free", "simple", "fast", "tiny", "small", "new", "easy",
  "based", "built", "build", "make", "makes", "just", "only", "also", "very",
  "cli", "tool", "tools", "app", "apps", "library", "lib", "framework", "project",
  "github", "https", "http", "com", "www", "readme", "docs", "documentation",
  "一个", "的", "和", "与", "是", "在", "了", "支持", "使用", "可以", "工具", "项目",
]);

/** Split arbitrary text into lowercase word tokens (CJK runs kept whole). */
export function tokenize(text) {
  if (typeof text !== "string") return [];
  return text
    .toLowerCase()
    .replace(/[\u0000-\u001f]/g, " ")
    .split(/[^a-z0-9\u4e00-\u9fff+#.-]+/u)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 2 && /[a-z0-9\u4e00-\u9fff]/u.test(token));
}

/** Extract weighted keywords from a repo profile. */
export function extractKeywords({ name = "", description = "", topics = [], readme = "" } = {}) {
  const scores = new Map();
  const bump = (token, weight) => {
    if (!token || token.length < 2 || STOPWORDS.has(token) || /^\d+$/.test(token)) return;
    if (!/[a-z0-9\u4e00-\u9fff]/u.test(token)) return;
    const entry = scores.get(token) ?? { weight: 0, count: 0 };
    entry.weight = Math.max(entry.weight, weight);
    entry.count += 1;
    scores.set(token, entry);
  };

  for (const topic of topics) {
    for (const token of tokenize(topic)) bump(token, 6);
    bump(String(topic).toLowerCase().trim(), 8);
  }
  for (const token of tokenize(name)) bump(token, 4);
  for (const token of tokenize(description)) bump(token, 3);

  // Headings and the first screen of the README are the strongest signal.
  const head = readme.slice(0, 4000);
  for (const token of tokenize(head)) bump(token, 1.5);
  for (const heading of head.matchAll(/^#{1,3}\s+(.+)$/gm)) {
    for (const token of tokenize(heading[1])) bump(token, 4);
  }
  for (const token of tokenize(readme.slice(4000, 20000))) bump(token, 0.5);

  return [...scores.entries()]
    .map(([keyword, entry]) => ({
      keyword,
      score: Math.round(entry.weight * (1 + Math.min(Math.log2(entry.count + 1), 2)) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score || a.keyword.localeCompare(b.keyword));
}

/** Heuristic: is this repo a curated list / comparison / resource collection? */
export function listness(repo) {
  const haystack = `${repo.fullName ?? ""} ${repo.name ?? ""} ${repo.description ?? ""} ${(repo.topics ?? []).join(" ")}`.toLowerCase();
  let score = 0;
  if (/(^|[-_/])awesome([-_/]|$)/.test(haystack)) score += 60;
  if (/\b(awesome|curated|collection|list of|resources|directory|catalog|showcase)\b/.test(haystack)) score += 25;
  if (/\b(alternatives|comparison|compare|vs\b|benchmark|landscape)\b/.test(haystack)) score += 15;
  if (/\b(toolkit|ecosystem|guide|cheatsheet|cheat sheet)\b/.test(haystack)) score += 10;
  if (repo.description && repo.description.length > 120) score += 5;
  return Math.min(score, 100);
}

/**
 * Does the README already mention the target project?
 * Exact URLs / full names always count. A bare repo name only counts when the
 * owner or repo URL also appears, to avoid false positives on common names.
 */
export function mentionOf(readme, target) {
  if (!readme) return null;
  const haystack = readme.toLowerCase();
  const fullName = target.fullName?.toLowerCase();
  const url = target.url?.toLowerCase();
  const owner = target.owner?.toLowerCase();
  const name = target.name?.toLowerCase();

  const strongNeedles = [url, fullName].filter((needle) => needle && needle.length >= 3);
  for (const needle of strongNeedles) {
    const index = haystack.indexOf(needle);
    if (index !== -1) return { needle, line: lineAt(readme, index) };
  }

  if (name && name.length >= 4 && owner) {
    const wordRe = new RegExp(`(^|[^a-z0-9])${escapeRegExp(name)}([^a-z0-9]|$)`, "i");
    const nameMatch = wordRe.exec(readme);
    const ownerMentioned = haystack.includes(owner) || haystack.includes(`/${name}`);
    if (nameMatch && ownerMentioned) {
      return { needle: name, line: lineAt(readme, nameMatch.index) };
    }
  }
  return null;
}

function lineAt(text, index) {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? undefined : end).trim().slice(0, 300);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Relevance of a candidate list to the target profile, 0-100. */
export function relevance(targetKeywords, repo, { idf = () => 1 } = {}) {
  if (!targetKeywords.length) return 0;
  const repoText = new Set(tokenize(`${repo.fullName} ${repo.description} ${(repo.topics ?? []).join(" ")}`));
  const top = targetKeywords.slice(0, 15);
  const maxScore = top.reduce((sum, item) => sum + item.score * idf(item.keyword), 0) || 1;
  let hit = 0;
  for (const { keyword, score } of top) {
    const weighted = score * idf(keyword);
    if (repoText.has(keyword)) hit += weighted;
    else if (findMatchingTokens(keyword, repoText).length > 0) hit += weighted * 0.6;
  }
  return Math.round(Math.min(100, (hit / maxScore) * 100));
}

/**
 * Inverse document frequency across candidate repos. Keywords that appear in
 * almost every candidate ("python", "ai", "tools") carry little signal.
 */
export function idfFrom(repos, targetKeywords) {
  const docs = repos.length || 1;
  const df = new Map();
  for (const repo of repos) {
    const text = new Set(tokenize(`${repo.fullName} ${repo.description} ${(repo.topics ?? []).join(" ")}`));
    for (const { keyword } of targetKeywords) {
      if (text.has(keyword)) df.set(keyword, (df.get(keyword) ?? 0) + 1);
    }
  }
  return (keyword) => {
    // With too few documents IDF is noise, so treat every keyword as specific.
    if (docs < 3) return 1;
    const seen = df.get(keyword) ?? 0;
    // 1.0 for a unique keyword, approaching 0.25 for one present everywhere.
    return Math.max(0.25, Math.log((docs + 1) / (seen + 1)) / Math.log(docs + 1) + 0.25);
  };
}

/**
 * How many distinct target keywords the candidate matches. A single generic
 * hit ("python" in a wordlist repo) is not enough; two or one very specific
 * topic-level hit is.
 */
export function matchEvidence(targetKeywords, repo, { idf = () => 1, specificThreshold = 0.55 } = {}) {
  const repoText = new Set(tokenize(`${repo.fullName} ${repo.description} ${(repo.topics ?? []).join(" ")}`));
  const matches = [];
  for (const { keyword, score } of targetKeywords.slice(0, 15)) {
    const tokenMatch = findMatchingTokens(keyword, repoText)[0];
    if (!tokenMatch) continue;
    const specific = idf(keyword) >= specificThreshold;
    const exact = repoText.has(keyword);
    matches.push({ keyword, token: tokenMatch, specific, exact, weight: score * idf(keyword) });
  }
  const specificMatches = matches.filter((match) => match.specific);
  const totalWeight = matches.reduce((sum, match) => sum + match.weight, 0);
  return {
    matches,
    count: matches.length,
    specificCount: specificMatches.length,
    totalWeight,
    strong: specificMatches.length >= 1 || matches.filter((match) => match.exact).length >= 2,
  };
}

/** Keep only candidates with meaningful, non-generic overlap. */
export function isRelevantMatch(targetKeywords, repo, options = {}) {
  return matchEvidence(targetKeywords, repo, options).strong;
}

/** Composite "gap" score: relevant, list-like, and big — in that order. */
export function gapScore({ stars, listnessScore, relevanceScore }) {
  const starPart = Math.min(100, Math.log10(Math.max(stars, 1) + 1) * 18);
  const score = relevanceScore * 0.5 + listnessScore * 0.25 + starPart * 0.25;
  return Math.round(Math.min(100, score) * 10) / 10;
}

/** Ready-to-paste Markdown entry for an awesome-list README. */
export function suggestEntry(target) {
  const description = (target.description || "TODO: one-line description").replace(/\s+/g, " ").trim();
  const short = description.length > 100 ? `${description.slice(0, 97)}...` : description;
  return `- [${target.name}](${target.url}) - ${short}`;
}

