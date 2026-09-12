/** Token comparison helpers: ASCII-aware, CJK-safe, generic-word aware. */

import { isGenericTerm } from "./generic.mjs";

export function isAsciiToken(token) {
  return /^[a-z0-9][a-z0-9+#.-]*$/.test(token);
}

/** Split a compound token into its parts: "python-tools" -> ["python","tools"]. */
export function tokenParts(token) {
  return String(token)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff+#]+/u)
    .filter(Boolean);
}

/** Do two single tokens refer to the same word? (prefix rule, min length 4) */
function atomicMatches(a, b) {
  if (a === b) return true;
  if (isGenericTerm(a) || isGenericTerm(b)) return false;
  if (!isAsciiToken(a) || !isAsciiToken(b)) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 4) return false;
  return long.startsWith(short) || long.endsWith(short);
}

/** The parts of a compound that carry its specificity (generic heads dropped). */
function specificParts(parts) {
  return parts.filter((part) => !isGenericTerm(part));
}

/**
 * Do two tokens refer to the same thing?
 *
 * Two rules keep this precise:
 *  1. A generic head noun alone is never enough. "python-tools" must not match
 *     a bare "Tools" section, because every list has one.
 *  2. Every specific part of the more detailed token must be covered. This is
 *     what stops "static-analysis" from matching "Static Site Generator" (no
 *     "analysis") or "Spatial Analysis" (no "static").
 */
export function tokenMatches(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (!isAsciiToken(a) || !isAsciiToken(b)) return false;

  const partsA = tokenParts(a);
  const partsB = tokenParts(b);

  if (partsA.length === 1 && partsB.length === 1) return atomicMatches(a, b);

  // Match in the direction of whichever token carries more specific detail.
  const specA = specificParts(partsA);
  const specB = specificParts(partsB);
  if (!specA.length || !specB.length) return false;

  const [required, available] = specA.length >= specB.length ? [specA, specB] : [specB, specA];
  return required.every((part) => available.some((candidate) => atomicMatches(part, candidate)));
}

/** Every token in `repoText` that matches `keyword`. */
export function findMatchingTokens(keyword, repoText) {
  return [...repoText].filter((token) => tokenMatches(keyword, token));
}

/**
 * Headings that are navigation or calls-to-action rather than topic sections.
 */
const NON_SECTION = /^(contents?|table of contents|toc|index|about|license|contributing|acknowledg|credits?|sponsors?|backers?|faq|changelog|roadmap|install|installation|usage|getting started|run one now|check out|star history|support|community|related|see also|links?|resources?|more|other|misc|appendix|footnotes?|disclaimer|thanks|why|how to|examples?|demos?|screenshots?|features?|news|updates?|contact|security|privacy|terms)/i;

/**
 * Normalize a heading for matching: strip emoji, badges, markdown links
 * (including their URLs — otherwise a link to python.langchain.com looks
 * like a "Python" section), and formatting noise.
 */
export function cleanHeading(heading) {
  return String(heading)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{2700}-\u{27BF}]/gu, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Is the heading just the list describing itself? Such headings contain only
 * words already present in the repo name.
 */
function isSelfTitle(heading, selfTokens) {
  if (!selfTokens.size) return false;
  // Ignore bigrams; only compare individual words so that a hyphenated repo
  // name ("awesome-functional-python") matches a spaced heading.
  const words = tokenizeHeading(heading).filter((word) => !word.includes("-"));
  if (!words.length) return true;
  return words.every((word) => selfTokens.has(word));
}

/**
 * Bare category words that are too broad to justify a section match on their
 * own. Unlike GENERIC_TERMS these are still allowed inside compounds, so
 * "cli-frameworks" can match "CLI Frameworks"; only the bare word "cli" is
 * ignored. Without this, every "Dotnet CLI" section looks like a fit for
 * every CLI project.
 */
const WEAK_SECTION_TERMS = new Set([
  "cli", "github", "oss", "distribution", "awesome", "awesome-list",
]);

/** True only when the whole keyword is a bare category word. */
function isWeakKeyword(keyword) {
  return WEAK_SECTION_TERMS.has(String(keyword).toLowerCase());
}

/** Is this heading a real topic section worth matching against? */
export function isTopicHeading(heading) {
  const cleaned = cleanHeading(heading);
  if (cleaned.length < 3 || cleaned.length > 60) return false;
  if (NON_SECTION.test(cleaned)) return false;
  if (cleaned.split(/\s+/).length > 7) return false;
  return /[a-z\u4e00-\u9fff]/i.test(cleaned);
}

/**
 * Analyze a README as a curated list: does it read like a list, and does any
 * genuine topic section match a specific target keyword?
 */
export function analyzeReadme(
  readme,
  targetKeywords,
  { idf = () => 1, specificThreshold = 0, repoName = "" } = {},
) {
  const text = typeof readme === "string" ? readme : "";
  const linkCount = (text.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  const bulletCount = (text.match(/^\s*[-*+]\s+/gm) ?? []).length;
  const allHeadings = [...text.matchAll(/^#{2,4}\s+(.+)$/gm)].map((match) => match[1].trim());
  const selfTokens = new Set([...tokenParts(repoName), ...tokenizeHeading(repoName)]);
  const headings = allHeadings
    .filter(isTopicHeading)
    // A list's own title ("Awesome Functional Python" in awesome-functional-
    // python) is not a section a new entry can be added to.
    .filter((heading) => !isSelfTitle(cleanHeading(heading), selfTokens));
  const isList = linkCount >= 15 && bulletCount >= 10;

  // Generic list-prose words can never justify a section match; the IDF gate
  // is opt-in because a project's own declared topic is legitimately common
  // across lists in its own ecosystem.
  const specificKeywords = targetKeywords.filter(
    (item) =>
      !isGenericTerm(item.keyword) &&
      !isWeakKeyword(item.keyword) &&
      idf(item.keyword) >= specificThreshold,
  );
  const matchedSections = [];
  for (const rawHeading of headings) {
    const heading = cleanHeading(rawHeading);
    const headingTokens = new Set(tokenizeHeading(heading));
    for (const { keyword, score } of specificKeywords) {
      const hit = findMatchingTokens(keyword, headingTokens)[0];
      if (hit) {
        matchedSections.push({ heading, keyword, score, matchedToken: hit });
        break;
      }
    }
  }

  return {
    isList,
    linkCount,
    bulletCount,
    headingCount: headings.length,
    headings,
    matchedSections,
    bestSection: [...matchedSections].sort((a, b) => b.score - a.score)[0] ?? null,
  };
}

/**
 * Tokenize a heading into unigrams plus adjacent bigrams, so that
 * "Static Analysis" can be compared against the compound "static-analysis"
 * while "Spatial Analysis" cannot.
 */
export function tokenizeHeading(heading) {
  const words = String(heading)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff+#.-]+/u)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 2 && /[a-z0-9\u4e00-\u9fff]/u.test(token));
  const bigrams = [];
  for (let i = 0; i < words.length - 1; i += 1) bigrams.push(`${words[i]}-${words[i + 1]}`);
  return [...words, ...bigrams];
}






