# Contributing

Thanks for helping make stargap more precise.

## Development

```bash
npm test
node bin/stargap.mjs astral-sh/ruff --min-stars 300 --limit 5
```

The test suite must stay offline. Inject fake `fetch` or search functions instead of calling GitHub.

## Pull requests

- Keep one concern per pull request.
- Add a regression test for every matching or filtering bug.
- Explain the false positive or false negative the change fixes.
- Do not lower the precision gates just to make a demo return more results.

## Reporting a bad match

Include:

1. The target repository.
2. The candidate repository.
3. The exact command you ran.
4. Why the match is wrong.

That makes it possible to turn every report into a focused regression test.