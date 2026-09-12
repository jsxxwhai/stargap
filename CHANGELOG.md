# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/jsxxwhai/stargap/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/jsxxwhai/stargap/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/jsxxwhai/stargap/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jsxxwhai/stargap/releases/tag/v0.1.0