/**
 * The vocabulary of "awesome list" prose. These words appear in nearly every
 * curated list, so matching them produces false positives ("Standard
 * Libraries" matching a Python library). They are excluded from a project's
 * declared identity and can never justify a section match.
 */
export const GENERIC_TERMS = new Set([
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

export function isGenericTerm(token) {
  return GENERIC_TERMS.has(String(token).toLowerCase());
}
