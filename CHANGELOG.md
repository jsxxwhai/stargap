# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-12

### Added

- A 100-point discoverability audit with 19 explainable checks across positioning, README, trust and reach.
- `stargap audit <owner/repo>` with terminal, Markdown, JSON and SVG badge output.
- Ranked, points-based fixes and a shareable score card with a Shields.io README badge.
- GitHub Action `mode: audit`, `score`, `grade`, `badge-output` and `fail-under` outputs.
- A weekly audit workflow example that opens or updates a labeled issue.

### Changed

- The browser app now leads with the discoverability score and shows the top fixes before the curated-list gaps.
- README positioning and launch plan now center the "your repo is not bad, it is invisible" promise.


## [0.1.3] - 2026-09-12

### Added

- Shareable browser results: a scan updates the URL, copy-link, X and Hacker News actions appear after a successful scan, and `?repo=` links auto-run.
- GitHub Action reports now also appear in the workflow job summary.

### Changed

- README quick start now uses verified clone and archive commands instead of the unverified `npx github:` path.
- Added browser-app regression tests, including a DOM sandbox that runs a full scan.

## [0.1.2] - 2026-09-12

### Fixed

- Keep `stargap --version` in sync with `package.json`; it previously reported 0.1.0 from the 0.1.1 package.

### Added

- Browser-app Open Graph/Twitter cards and a 1280x640 social preview image.
- A GitHub-hosted zero-install command in the README while npm publishing is pending.

## [0.1.1] - 2026-09-12

### Fixed

- Ignore bare category words such as `cli` when matching section headings, removing false positives from unrelated sections like "Dotnet CLI".
- Keep qualified compound keywords such as `cli-frameworks` eligible for exact section matches.
- Add two regression tests for the section-matching behavior.

## [0.1.0] - 2026-09-12

### Added

- Zero-dependency Node CLI for finding high-star curated lists that omit a repository.
- Focused `awesome in:name <topic>` GitHub search, de-duplication and caching.
- Curated-list detection, topic-section matching, existing-entry detection and gap ranking.
- Terminal, Markdown and JSON reports with paste-ready entries.
- Composite GitHub Action and scheduled workflow example.
- 33 offline tests covering matching, scanning, caching, rate limits and rendering.

[Unreleased]: https://github.com/jsxxwhai/stargap/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jsxxwhai/stargap/compare/v0.1.3...v0.2.0
[0.1.2]: https://github.com/jsxxwhai/stargap/compare/v0.1.1...v0.1.3
[0.1.1]: https://github.com/jsxxwhai/stargap/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jsxxwhai/stargap/releases/tag/v0.1.0