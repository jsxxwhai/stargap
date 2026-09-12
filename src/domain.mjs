/**
 * Domain evidence: is a matched section actually about the candidate list's
 * own subject, or just a word collision inside an unrelated list?
 *
 * Section matching alone answers "does the heading contain a project keyword".
 * That is necessary but not sufficient: a list can mention the keyword once in
 * a broad domain and still be the wrong place for the project.
 */

const DOMAIN_STOPWORDS = new Set([
  "awesome", "curated", "collection", "list", "lists", "directory", "catalog",
  "resources", "resource", "software", "library", "libraries", "framework",
  "frameworks", "package", "packages", "tool", "tools", "toolkit", "utility",
  "utilities", "app", "apps", "application", "applications", "project",
  "projects", "code", "development", "programming", "language", "platform",
  "system", "systems", "service", "services", "solution", "solutions",
  "standard", "miscellaneous", "various", "related", "general", "other",
  "reading", "writing", "editing", "management", "productivity", "learning",
  "tutorial", "tutorials", "guide", "guides", "example", "examples", "demo",
  "demos", "sample", "samples", "tips", "best", "top", "popular", "useful",
  "great", "good", "high", "quality", "free", "open", "source", "modern",
  "simple", "lightweight", "powerful", "extensible", "cross", "multi",
  "data", "web", "mobile", "desktop", "cloud", "server", "client", "api",
  "file", "files", "text", "image", "images", "video", "audio", "security",
  "testing", "test", "tests", "debug", "logging", "monitoring", "database",
  "databases", "storage", "network", "networking", "docs", "documentation",
]);

const SELF_NAMES = new Set([
  "awesome", "curated", "list", "lists", "collection", "directory", "catalog",
  "resources", "resource", "github", "githubs",
]);

function words(value) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff+#.-]+/u)
    .map((token) => token.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((token) => token.length >= 2 && /[a-z0-9\u4e00-\u9fff]/u.test(token));
}

/**
 * Build the list's own declared subject from its name, description and topics.
 * This deliberately excludes README body prose: the question is what the list
 * says it is, not every word that happens to appear in its README.
 */
/**
 * Repos whose purpose is editorial content rather than a curated directory of
 * projects. These are not appropriate places to add a project entry.
 */
const NON_DIRECTORY_REPO = /\b(interview|questions?|answers?|jobs?|hiring|career|tutorials?|courses?|books?|learning|roadmap|cheatsheet|blog)\b/i;

export function listSubject(repo = {}) {
  const source = [
    repo.fullName,
    repo.name,
    repo.description,
    ...(repo.topics ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const subject = new Set();
  for (const word of words(source)) {
    if (DOMAIN_STOPWORDS.has(word) || SELF_NAMES.has(word)) continue;
    if (/^\d+$/.test(word)) continue;
    subject.add(word);
  }
  return subject;
}

/**
 * Return a small, human-readable reason when a candidate list's declared
 * subject agrees with the matched project keywords. This is intentionally
 * conservative: a missing subject is not treated as a contradiction, but a
 * clearly different subject (Rust list vs. Python linter) is.
 */
export function domainEvidence(targetKeywords, repo, options = {}) {
  const repoIdentity = `${repo.fullName ?? ""} ${repo.name ?? ""} ${repo.description ?? ""}`;
  if (NON_DIRECTORY_REPO.test(repoIdentity)) {
    return { ok: false, reason: "editorial/learning repository, not a project directory", overlap: [] };
  }

  const subject = listSubject(repo);
  if (!subject.size) return { ok: true, reason: "list subject unavailable", overlap: [] };

  const target = new Set();
  for (const item of targetKeywords.slice(0, 30)) {
    for (const word of words(item.keyword)) {
      if (!DOMAIN_STOPWORDS.has(word) && !SELF_NAMES.has(word)) target.add(word);
    }
  }

  const overlap = [...subject].filter((word) => target.has(word));
  if (overlap.length) return { ok: true, reason: `subject overlap: ${overlap.slice(0, 4).join(", ")}`, overlap };

  // A list can be titled generically ("awesome") while its description/topics
  // provide the real subject. If we still have no overlap, allow only when the
  // candidate is explicitly a meta-list of lists; those legitimately collect
  // adjacent ecosystems.
  const meta = /\b(awesome-awesome|awesome lists?|list of awesome|meta)\b/i.test(
    `${repo.fullName ?? ""} ${repo.name ?? ""} ${repo.description ?? ""}`,
  );
  if (meta) return { ok: true, reason: "meta-list of lists", overlap: [] };

  return {
    ok: false,
    reason: `list subject (${[...subject].slice(0, 5).join(", ")}) does not overlap project keywords`,
    overlap: [],
  };
}

/** Convenience predicate for callers that only need the boolean. */
export function hasDomainEvidence(targetKeywords, repo, options = {}) {
  return domainEvidence(targetKeywords, repo, options).ok;
}
