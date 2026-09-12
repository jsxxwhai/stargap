# stargap

**Your repo isn't bad. It's invisible.** Score it out of 100, fix the highest-impact gaps, then find the high-star awesome lists that should mention you — but don't.

> If this saves you a README crawl, [star the repo](https://github.com/jsxxwhai/stargap) so other maintainers can find it.

[![CI](https://github.com/jsxxwhai/stargap/actions/workflows/ci.yml/badge.svg)](https://github.com/jsxxwhai/stargap/actions/workflows/ci.yml) [![release](https://img.shields.io/github/v/release/jsxxwhai/stargap)](https://github.com/jsxxwhai/stargap/releases) [![license](https://img.shields.io/github/license/jsxxwhai/stargap)](LICENSE)

**Try it in your browser → [jsxxwhai.github.io/stargap](https://jsxxwhai.github.io/stargap/)** — no install required.

![stargap demo](docs/demo.svg)

You shipped something useful. The people who need it never see it. `stargap` scores why, ranks the fixes by points recovered, then finds the high-star lists that should mention you — but don't.

```console
$ node bin/stargap.mjs audit astral-sh/ruff

stargap audit — astral-sh/ruff

84.2/100  A  1 high-star gap

Positioning  █████████████████░░░  87.5
README       ████████████████░░░░  80
Trust        ███████████████████░  95
Reach        ███████████████░░░░░  78.3

Top fixes
1. +12 High-star list coverage
2. +5  Visual proof
3. +2.4 Specific GitHub topics

Share: https://jsxxwhai.github.io/stargap/?repo=astral-sh%2Fruff
Badge: stargap audit astral-sh/ruff --badge --out stargap-badge.svg
```

One command. No signup, no dashboard, no growth-hacking SaaS.

[Full example report](docs/example-report.md) · [Audit example](docs/example-audit.md) · [GitHub Action](action.yml)

## Why this exists

Getting stars is not only a code problem; it is also a distribution problem. A great README is invisible until people can find it, and a curated list that already ranks well can put your project in front of exactly the right users.

`stargap` gives you two things most maintainers never have time to build:

1. **A 100-point discoverability audit** with 19 explainable checks, concrete evidence and a ranked fix list.
2. **A verified gap list** of high-star curated lists that have a matching section but do not mention you yet, plus a paste-ready entry.

Both run without an account, a backend or a build step.

## Quick start

The fastest path is the [browser app](https://jsxxwhai.github.io/stargap/) — no install, no account, no backend.

For the CLI, run the released version from a shallow clone. Node 18+ and Git are the only requirements:

```bash
git clone --depth 1 --branch v0.2.0 https://github.com/jsxxwhai/stargap
cd stargap
node bin/stargap.mjs audit astral-sh/ruff
```

The archive route works without Git too:

```bash
curl -fsSL https://github.com/jsxxwhai/stargap/archive/refs/tags/v0.2.0.tar.gz | tar -xz
cd stargap-0.2.0
node bin/stargap.mjs audit astral-sh/ruff
```

```bash
# Score only: positioning, README, trust and reach
node bin/stargap.mjs audit astral-sh/ruff

# Markdown audit report for an issue, PR or release note
node bin/stargap.mjs audit astral-sh/ruff --markdown --out AUDIT.md

# Generate a README badge
node bin/stargap.mjs audit astral-sh/ruff --badge --out stargap-badge.svg

# Find missing curated lists and get paste-ready entries
node bin/stargap.mjs astral-sh/ruff --min-stars 300 --limit 6
```

Once the package is published to npm, `npx stargap <owner/repo>` will be the shortest path. The clone and archive commands above are verified today.

## Set a token (recommended)

Unauthenticated GitHub allows **60 core requests/hour** and only **10 search requests/hour**. A real scan can exhaust that quickly.

```bash
export GITHUB_TOKEN=ghp_xxx   # classic token, no scopes needed
node bin/stargap.mjs doctor   # shows remaining budget
```

Responses are cached in `~/.stargap/cache` for 24h, so repeat scans are nearly free. `node bin/stargap.mjs cache` clears it.

## The 100-point discoverability audit

`stargap audit <owner/repo>` scores four things that decide whether a visitor stars, installs or scrolls past:

| Dimension | Points | What it checks |
|---|---:|---|
| Positioning | 25 | description, topics, homepage, one-paragraph pitch, searchable name |
| README | 25 | substance, install path, runnable example, visual proof, scannable structure |
| Trust | 20 | license, visible CI, contribution path, security path, recent activity |
| Reach | 30 | stars, high-star list coverage, channel count, curated-list fit |

Every check returns evidence and a concrete fix. The result is explainable, deterministic and works on any public repository.

```console
$ node bin/stargap.mjs audit astral-sh/ruff

stargap audit — astral-sh/ruff

88.4/100  A  1 high-star gap

Positioning  ████████████████░░░░  80.6
README       █████████████████░░░  86.7
Trust        ███████████████████░  95
Reach        ████████████████░░░░  82.5

Top fixes
1. +12 High-star list coverage
   Get listed in the high-star curated lists that already match your topic; each one is a permanent discovery channel.
2. +5 Visual proof
   Add a screenshot, terminal recording, GIF or short video; visual proof is the strongest README conversion lever.

Share: https://jsxxwhai.github.io/stargap/?repo=astral-sh%2Fruff
Badge: stargap audit astral-sh/ruff --badge --out stargap-badge.svg
```

Use `--markdown` for an issue or release note, `--json` for automation, and `--badge` for a README badge:

```markdown
[![stargap score 88.4/100 A](https://img.shields.io/badge/stargap-88.4%2F100%20A-2ea44f)](https://jsxxwhai.github.io/stargap/?repo=astral-sh%2Fruff)
```

## What it actually does

1. **Profiles your repo** — topics, name, description and README become a weighted keyword set. Topics and headings count for more than body prose.
2. **Searches focused queries** — `awesome in:name <topic>` for each top topic, merged and de-duplicated. The `in:name` qualifier keeps the search focused on actual list repos instead of matching README prose.
3. **Filters to real curated lists** — a candidate must contain at least 15 Markdown links and 10 bullets, not just mention your topic in prose.
4. **Drops lists that already have you** — exact URL and `owner/repo` matches, plus guarded bare-name matching so `other` does not match `another`.
5. **Requires a genuine topic section** — the list must have a real section such as `Static Analysis` or `Package Management` that matches your project's declared identity. Generic headings like `Tools` and navigation headings like `Contents` do not count.
6. **Ranks the gaps** — relevance x list-ness x reach (log-scaled stars), with IDF so common ecosystem words carry less signal than your niche terms.
7. **Drafts the entry** — a ready-to-paste Markdown bullet based on your repository metadata.

## Scoring

| Signal | Weight | Why |
|---|---:|---|
| Relevance | 50% | A list about your topic is worth more than a big generic one |
| List-ness | 25% | Link collections accept entries; blog posts do not |
| Reach | 25% | `log10(stars)` — 100k stars is not 100x more valuable than 1k |

`--min-stars` filters first, then the score decides the order.

## Output

```json
{
  "schemaVersion": 1,
  "repo": "acme/widget",
  "gaps": [
    {
      "fullName": "awesome/awesome-cli",
      "stars": 12000,
      "score": 68.4,
      "section": "Package Management",
      "entry": "- [widget](https://github.com/acme/widget) - A tiny CLI that does the thing."
    }
  ]
}
```

## Using the results well

`stargap` tells you where you are missing. It does **not** open PRs for you — deliberately. Use the command above, or the browser app.

- Read each list's `CONTRIBUTING.md` and follow it exactly.
- Open **one PR per list**, explain why the entry fits that section, and keep it short.
- Never mass-open identical PRs. That is spam, it gets you blocked, and it burns the reputation you need later.
- Some lists only accept entries after a project passes a bar (stars, age, tests). Come back when you do.

The tool is a research aid. The judgment is yours.

## Commands

```text
stargap <owner/repo> [options]        Find gaps
stargap audit <owner/repo> [options]  Score discoverability and get fixes
stargap audit <owner/repo> --badge    Generate an SVG score badge
stargap doctor                        Show token and rate-limit status
stargap cache                         Clear the local cache
```

| Flag | Default | Meaning |
|---|---:|---|
| `--min-stars <n>` | `100` | Ignore smaller repos |
| `--limit <n>` | `20` | Max gaps reported |
| `--candidates <n>` | `40` | Max candidates inspected |
| `--query <q>` | auto | Override the generated search |
| `--markdown` / `--json` | terminal | Output format |
| `--badge` | off | SVG score badge (audit only) |
| `--out <file>` | stdout | Write to a file |
| `--token <token>` | env | GitHub token |
| `--no-cache` | off | Bypass the cache |
| `--quiet` | off | Suppress progress |

## Programmatic use

```js
import { loadRepoProfile, findGaps } from "stargap";

const profile = await loadRepoProfile("acme/widget");
const gaps = await findGaps(profile, { minStars: 500 });
```

## GitHub Action

Run the audit every week and keep the result visible without installing anything:

```yaml
- uses: jsxxwhai/stargap@v0.2.0
  with:
    mode: audit
    min-stars: "1000"
    output: stargap-report.md
    badge-output: stargap-badge.svg
    fail-under: "70"
```

The report is written to the job summary and exposed as `steps.<id>.outputs.report`. Audit mode also exposes `score`, `grade` and an optional `badge` path. `fail-under` turns the score into a quality gate, while `mode: gaps` keeps the original list-only behavior.

See [examples/stargap.yml](examples/stargap.yml) for a scheduled workflow that opens or updates an issue when the score drops.

## Development

```bash
git clone https://github.com/jsxxwhai/stargap
cd stargap
npm test        # offline test suite, no network required
```

Everything is plain ESM with zero runtime dependencies. Tests inject fake `fetch` and search functions, so the suite never touches the network.

## Limits

- GitHub search caps at 1,000 results per query; `stargap` uses several focused queries instead of paging deep.
- List-ness, relevance and section matching are heuristics. Expect occasional false positives — check before you PR.
- It only knows what is in a README. Lists that track entries in a separate file or website are missed.
- The public GitHub API has low unauthenticated rate limits. Set `GITHUB_TOKEN` for regular use.

## Launching

Building something that deserves stars is not the same as getting them. The [launch plan](docs/launch.md) is the short, honest checklist used for this repository.

If you maintain an OSS project and want to help shape this tool, open a [bad-match report](https://github.com/jsxxwhai/stargap/issues/new?template=bad_match.md). Precision reports become regression tests.

## License

MIT
