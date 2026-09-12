/**
 * Repository discoverability audit.
 *
 * The audit is intentionally explainable: every point comes from a named check
 * with concrete evidence, so a maintainer can see what to fix next. It is not
 * a vanity metric and it does not reward buying stars or spamming lists.
 */

const DAY = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function text(value) {
  return typeof value === "string" ? value : "";
}

function hasAny(source, patterns) {
  return patterns.some((pattern) => pattern.test(source));
}

function countMatches(source, regex) {
  return [...source.matchAll(regex)].length;
}

function daysSince(value, now) {
  if (!value) return Infinity;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Infinity;
  return Math.max(0, (now.getTime() - time) / DAY);
}

function check(id, dimension, label, max, earned, advice, evidence = "") {
  const points = Math.round(clamp(earned, 0, max) * 10) / 10;
  return {
    id,
    dimension,
    label,
    max,
    earned: points,
    status: points >= max ? "pass" : points > 0 ? "warn" : "fail",
    advice,
    evidence,
  };
}

function firstParagraph(readme) {
  const withoutTitle = readme.replace(/^#\s+.*(?:\r?\n)+/, "");
  const stop = withoutTitle.search(/^#{2,}\s/m);
  const head = stop === -1 ? withoutTitle : withoutTitle.slice(0, stop);
  const paragraph = head
    .split(/\r?\n\r?\n/)
    .map((part) => part.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim())
    .find((part) => part.length >= 20 && !/^[>|<]/.test(part));
  return paragraph ?? "";
}

function buildChecks(meta, readme, gaps, now) {
  const name = text(meta.name) || text(meta.fullName).split("/").pop();
  const description = text(meta.description).trim();
  const topics = Array.isArray(meta.topics) ? meta.topics.filter(Boolean) : [];
  const homepage = text(meta.homepage).trim();
  const license = meta.license && (typeof meta.license === "string" ? meta.license : meta.license.spdxId || meta.license.name);
  const head = readme.slice(0, 1200);
  const paragraph = firstParagraph(readme);
  const headings = countMatches(readme, /^#{1,4}\s+.+$/gm);
  const hasImage = hasAny(readme.slice(0, 10000), [
    /!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp|svg)/i,
    /<img\b/i,
    /youtube\.com|youtu\.be|asciinema\.org|loom\.com/i,
  ]);
  const hasInstall = hasAny(head, [
    /^#{1,4}\s+(?:install(?:ation)?|getting started|quick ?start|setup)\b/im,
    /```(?:bash|sh|shell|console|zsh)/i,
  ]);
  const hasUsage = hasAny(readme, [
    /^#{1,4}\s+(?:usage|quick ?start|example|how (?:it|to) works?)\b/im,
  ]) && /```/m.test(readme);
  const hasCi = hasAny(readme, [
    /badge\.svg[^)]*(?:actions|ci|workflow)/i,
    /github\.com\/[^/]+\/[^/]+\/actions\/workflows/i,
    /\b(?:ci|continuous integration)\b/i,
  ]);
  const hasContributing = /^#{1,4}\s+contribut/im.test(readme) || /\bCONTRIBUTING\.md\b/i.test(readme);
  const hasSecurity = /^#{1,4}\s+security/im.test(readme) || /\bSECURITY\.md\b/i.test(readme);
  const freshDays = daysSince(meta.pushedAt ?? meta.updatedAt, now);

  const gapStars = gaps.map((gap) => Number(gap.stars) || 0);
  const reachGapPoints = gaps.reduce((sum, gap) => {
    const stars = Number(gap.stars) || 0;
    if (stars < 500) return sum + 0.5;
    return sum + clamp(1.5 + Math.log10(stars) / 2, 1.5, 4);
  }, 0);

  return [
    // Positioning: can a stranger tell what this is and who it is for?
    check("description", "Positioning", "Clear one-line description", 6,
      description.length >= 30 && description.length <= 200 ? 6 : description.length >= 12 ? 3 : 0,
      "Add a 30-200 character GitHub description that names the audience and the outcome.",
      description || "missing"),
    check("topics", "Positioning", "Specific GitHub topics", 8,
      Math.min(8, topics.length * 0.8),
      "Add 5-12 specific topics; they are both discovery keywords and the input to list matching.",
      `${topics.length} topic${topics.length === 1 ? "" : "s"}`),
    check("homepage", "Positioning", "Live demo or docs link", 5,
      homepage || /https?:\/\/[^\s)]+/i.test(head) ? 5 : 0,
      "Put a live demo, docs site or quick-start link near the top of the README and in the repo homepage.",
      homepage || "no homepage"),
    check("pitch", "Positioning", "One-paragraph pitch", 3,
      paragraph.length >= 60 ? 3 : paragraph.length >= 20 ? 1.5 : 0,
      "Open with one paragraph: the problem, what it does, and the single command or link to try it.",
      paragraph ? `${paragraph.length} chars` : "missing"),
    check("name", "Positioning", "Searchable project name", 3,
      name && name.length <= 30 ? 3 : name && name.length <= 45 ? 1.5 : 0,
      "Keep the name short enough to type and search; avoid a name that is only a generic word.",
      name || "missing"),

    // README: can a visitor evaluate and run it in under a minute?
    check("readme-length", "README", "Enough README substance", 5,
      readme.length >= 2000 ? 5 : readme.length >= 800 ? 3 : readme.length >= 200 ? 1 : 0,
      "Expand the README past a stub: what it is, why it exists, install, usage, examples and limits.",
      `${readme.length} chars`),
    check("install", "README", "Copy-paste install path", 5,
      hasInstall ? 5 : 0,
      "Add an Install or Quick start section with a copy-paste command.",
      hasInstall ? "found" : "missing"),
    check("usage", "README", "Runnable usage example", 5,
      hasUsage ? 5 : 0,
      "Add a Usage section with a real input and the output a user should expect.",
      hasUsage ? "found" : "missing"),
    check("demo", "README", "Visual proof", 5,
      hasImage ? 5 : 0,
      "Add a screenshot, terminal recording, GIF or short video; visual proof is the strongest README conversion lever.",
      hasImage ? "found" : "missing"),
    check("structure", "README", "Scannable structure", 5,
      headings >= 6 ? 5 : headings >= 3 ? 3 : headings >= 1 ? 1 : 0,
      "Use descriptive H2/H3 headings so visitors can scan instead of reading a wall of text.",
      `${headings} headings`),

    // Trust: why should a stranger install this today?
    check("license", "Trust", "Clear license", 5,
      license || /\b(?:MIT|Apache-2\.0|BSD|GPL|MPL|ISC)\b/i.test(head) ? 5 : 0,
      "Add a LICENSE file and link it from the README.",
      license || (/\b(?:MIT|Apache-2\.0|BSD|GPL|MPL|ISC)\b/i.test(head) ? "mentioned in README" : "missing")),
    check("ci", "Trust", "Visible CI or test signal", 5,
      hasCi ? 5 : 0,
      "Add a CI badge and a test command so visitors can see the project is maintained.",
      hasCi ? "found" : "missing"),
    check("contributing", "Trust", "Contribution path", 3,
      hasContributing ? 3 : 0,
      "Add CONTRIBUTING.md or a short Contributing section with the one command a newcomer should run.",
      hasContributing ? "found" : "missing"),
    check("security", "Trust", "Security / support path", 2,
      hasSecurity ? 2 : 0,
      "Add SECURITY.md or a Security section so users know how to report a vulnerability.",
      hasSecurity ? "found" : "missing"),
    check("freshness", "Trust", "Recent activity", 5,
      freshDays <= 180 ? 5 : freshDays <= 365 ? 3 : freshDays <= 730 ? 1 : 0,
      "Ship a small release or commit at least every few months; stale repos lose stars at the install decision.",
      Number.isFinite(freshDays) ? `last push ${Math.round(freshDays)} days ago` : "unknown"),

    // Reach: distribution beyond the repo itself.
    check("stars", "Reach", "Existing social proof", 10,
      clamp((Math.log10((Number(meta.stars) || 0) + 1) / Math.log10(100001)) * 10, 0, 10),
      "Stars compound: a launch post, a useful README and one high-signal community post do more than a badge wall.",
      `${Number(meta.stars) || 0} stars`),
    check("gaps", "Reach", "High-star list coverage", 12,
      Math.min(12, reachGapPoints),
      "Get listed in the high-star curated lists that already match your topic; each one is a permanent discovery channel.",
      `${gaps.length} gap${gaps.length === 1 ? "" : "s"}`),
    check("gap-count", "Reach", "Multiple distribution channels", 4,
      gaps.length >= 5 ? 4 : gaps.length >= 3 ? 3 : gaps.length >= 1 ? 2 : 0,
      "Look beyond one ecosystem list: language lists, tooling lists, self-hosted lists and awesome meta-lists all reach different users.",
      `${gaps.length} candidate list${gaps.length === 1 ? "" : "s"}`),
    check("curated", "Reach", "Curated-list fit", 4,
      gaps.some((gap) => Number(gap.listness) >= 60) ? 4 : gaps.length ? 2 : 0,
      "Prioritize genuine curated lists with a matching section rather than broad directories or blog posts.",
      gaps.some((gap) => Number(gap.listness) >= 60) ? "curated list found" : "none confirmed"),
  ];
}

function gradeFor(score) {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function auditRepo(meta = {}, readme = "", gaps = [], { now = new Date() } = {}) {
  const checks = buildChecks(meta, text(readme), Array.isArray(gaps) ? gaps : [], now);
  const earned = checks.reduce((sum, item) => sum + item.earned, 0);
  const max = checks.reduce((sum, item) => sum + item.max, 0) || 100;
  const score = Math.round((earned / max) * 1000) / 10;
  const grade = gradeFor(score);
  const dimensions = ["Positioning", "README", "Trust", "Reach"].map((name) => {
    const items = checks.filter((item) => item.dimension === name);
    const dimensionMax = items.reduce((sum, item) => sum + item.max, 0);
    const dimensionEarned = items.reduce((sum, item) => sum + item.earned, 0);
    return {
      name,
      score: Math.round((dimensionEarned / dimensionMax) * 1000) / 10,
      earned: Math.round(dimensionEarned * 10) / 10,
      max: dimensionMax,
    };
  });
  const fixes = checks
    .filter((item) => item.status !== "pass")
    .sort((a, b) => (b.max - b.earned) - (a.max - a.earned) || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((item) => ({ id: item.id, dimension: item.dimension, label: item.label, points: Math.round((item.max - item.earned) * 10) / 10, advice: item.advice }));

  const fullName = meta.fullName || "owner/repo";
  const shareUrl = `https://jsxxwhai.github.io/stargap/?repo=${encodeURIComponent(fullName)}`;
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    repo: fullName,
    score,
    grade,
    dimensions,
    checks,
    fixes,
    gaps: Array.isArray(gaps) ? gaps.length : 0,
    stars: Number(meta.stars) || 0,
    share: {
      url: shareUrl,
      text: `stargap score: ${score}/100 (${grade}) for ${fullName}. ${Array.isArray(gaps) ? gaps.length : 0} high-star curated list${Array.isArray(gaps) && gaps.length === 1 ? "" : "s"} still missing it.`,
      badge: `[![stargap score ${score}/100 ${grade}](https://img.shields.io/badge/stargap-${encodeURIComponent(`${score}/100 ${grade}`)}-${gradeColor(grade).slice(1)})](${shareUrl})`,
    },
  };
}

export function gradeColor(grade) {
  if (grade === "A+" || grade === "A") return "#2ea44f";
  if (grade === "B") return "#d29922";
  if (grade === "C") return "#db6d28";
  return "#da3633";
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]));
}

/** Static SVG badge. Dynamic hosting is intentionally left to GitHub Pages. */
export function renderBadge(result, { label = "stargap score" } = {}) {
  const value = `${result.score}/100 ${result.grade}`;
  const color = gradeColor(result.grade);
  const labelWidth = Math.max(72, Math.round(label.length * 6.4) + 12);
  const valueWidth = Math.max(58, Math.round(value.length * 6.4) + 12);
  const total = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${escapeXml(label)}: ${escapeXml(value)}">
  <title>${escapeXml(label)}: ${escapeXml(value)}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)"><rect width="${labelWidth}" height="20" fill="#555"/><rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/><rect width="${total}" height="20" fill="url(#s)"/></g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11"><text x="${Math.round(labelWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text><text x="${Math.round(labelWidth / 2)}" y="14">${escapeXml(label)}</text><text x="${labelWidth + Math.round(valueWidth / 2)}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text><text x="${labelWidth + Math.round(valueWidth / 2)}" y="14">${escapeXml(value)}</text></g>
</svg>
`;
}
