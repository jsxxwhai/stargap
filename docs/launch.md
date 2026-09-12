# Launch plan

The code is only half of a high-star repository. The other half is making the
right maintainers and users see it once, then letting the result compound.

## Positioning

One sentence: **stargap finds the high-star awesome lists that should mention
your project but do not.**

The reader is an OSS maintainer who already shipped something and wants
distribution. The promise is a ranked, evidence-backed gap list — not a growth
dashboard and not automated spam.

## Before publishing

- [ ] Create the GitHub repository and push `main`.
- [ ] Add the repository description: "Find the high-star GitHub repos that should mention your project — but don't."
- [ ] Add topics: `awesome-list`, `github`, `cli`, `oss`, `developer-tools`, `distribution`.
- [ ] Publish `v0.1.0` and attach release notes.
- [ ] Publish to npm so the short `npx stargap` form works; until then, document the verified GitHub tarball command.
- [ ] Enable Issues and Discussions; keep Issues enabled so bad-match reports become regression tests.

## Launch post (Show HN / Reddit / Lobsters)

Title options:

- Show HN: stargap – find the awesome lists that should mention your project
- I built a tool that finds the awesome-lists missing your project

Post body:

> Awesome-lists are one of the highest-leverage distribution channels for a new
> OSS project, but checking whether a list already includes you means reading
> hundreds of READMEs.
>
> stargap profiles your repo, searches for curated lists in your topic, verifies
> that each candidate is a real list with a matching section, checks that it
> does not already mention you, and ranks the gaps by relevance, list-ness and
> reach. It outputs a paste-ready entry.
>
> It is a zero-dependency Node CLI: `npx --yes github:jsxxwhai/stargap#v0.1.1 <owner/repo>`.
>
> I deliberately made it precise rather than exhaustive — early versions
> reported every "Tools" section as a match, so I added full-coverage topic
> matching and regression tests for the false positives. I would rather return
> one real gap than fifty noisy ones.
>
> Example: `npx --yes github:jsxxwhai/stargap#v0.1.1 astral-sh/ruff --min-stars 300`
>
> I would love feedback on false positives and false negatives. Those reports
> are the most useful contribution right now.

## Distribution checklist

- [ ] Show HN on a weekday morning, US Pacific time.
- [ ] r/opensource and r/github — follow each community's self-promotion rules.
- [ ] Lobsters `programming` tag.
- [ ] Hacker News comments: answer technical questions, do not paste the link again.
- [ ] Submit a PR to relevant awesome-lists only after the repository has a release, tests and a clear README.
- [ ] Add a short section to your own project READMEs: "Find where this project is missing."
- [ ] Ask five maintainers for honest feedback, not for a star.

## What converts visitors into stars

- The first screen shows a real terminal result and the exact command.
- The README links to a full example report.
- The tool does one thing and explains its precision tradeoff.
- `npx` works with no install and no dependencies.
- The GitHub Action gives the project a second use case without extra setup.
- The limits section is honest about heuristics and false positives.

## Metrics that matter

- Visitors who run the command at least once.
- Bad-match issues opened and closed with a regression test.
- Weekly npm downloads.
- Stars per week after the launch spike, not the spike itself.

## Do not do

- Do not mass-open PRs to awesome-lists. That gets the account blocked and
  destroys the reputation the project needs.
- Do not buy stars. It is visible in the star graph and it is disqualifying.
- Do not claim the tool finds every relevant list. Precision is the selling
  point; overclaiming invites the exact criticism that kills the launch.