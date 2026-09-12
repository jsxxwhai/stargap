# Launch plan

The code is only half of a high-star repository. The other half is making the
right maintainers and users see it once, then letting the result compound.

## Positioning

One sentence: **stargap scores why your repository is invisible, then shows
the exact fixes and high-star lists that should mention it but do not.**

The reader is an OSS maintainer who already shipped something and wants
distribution. The promise is a ranked, evidence-backed gap list — not a growth
dashboard and not automated spam.

## Before publishing

- [ ] Create the GitHub repository and push `main`.
- [ ] Add the repository description: "Score your repo's discoverability and find the high-star awesome lists that should mention it."
- [ ] Add topics: `awesome-list`, `github`, `discoverability`, `readme`, `cli`, `oss`, `developer-tools`, `distribution`.
- [ ] Publish `v0.2.0` and attach release notes.
- [ ] Publish to npm so the short `npx stargap` form works; until then, document the verified clone/archive commands.
- [ ] Enable Issues and Discussions; keep Issues enabled so bad-match reports become regression tests.

## Launch post (Show HN / Reddit / Lobsters)

Title options:

- Show HN: stargap – score why your GitHub repo is invisible
- I built a 30-second discoverability audit for GitHub repos

Post body:

> Your repository probably is not bad. It is invisible. The README does not
> explain the outcome, the install path takes too long to find, there is no
> visual proof, and the high-star lists in your category do not mention you.
>
> stargap scores all of that out of 100, returns the exact fixes, then finds the
> curated lists that should mention you but do not.
>
> It is a zero-dependency Node CLI with 19 explainable checks. It also profiles
> your repo, verifies that each candidate is a real list with a matching
> section, checks that it does not already mention you, and outputs a paste-ready
> entry. Clone the release and run it in one line:
>
> I deliberately made it precise rather than exhaustive — early versions
> reported every "Tools" section as a match, so I added full-coverage topic
> matching and regression tests for the false positives. I would rather return
> one real gap than fifty noisy ones.
>
> `git clone --depth 1 --branch v0.2.0 https://github.com/jsxxwhai/stargap && cd stargap && node bin/stargap.mjs audit astral-sh/ruff`
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

- The first screen promises a 30-second score and shows a real result card.
- The score, badge and ranked fixes are shareable and work as a README badge.
- The README links to a full example report.
- The tool does one thing and explains its precision tradeoff.
- The browser app and the CLI both run with no account and no backend.
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