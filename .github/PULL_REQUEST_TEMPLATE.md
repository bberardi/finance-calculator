## Summary

What does this PR do and why? (2–3 sentences is usually enough.)

## Related

- Closes #
- Roadmap item: <!-- e.g. "Roadmap 6.x" or "n/a" -->

## Type of change

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] Docs
- [ ] Chore
- [ ] Performance

## Checklist

- [ ] `npm test`, `npm run build`, `npm run check:lint`, and `npm run check:format` all pass
- [ ] New business logic lives in `src/helpers/` with unit tests; UI stays thin
- [ ] Math-touching changes uphold the [Math Correctness Charter](../ROADMAP.md#4-math-correctness-charter-non-negotiable): cited reference tests, invariants, and 100% line+branch coverage on `src/helpers/**`
- [ ] Models stay input-only (derived data is computed, never stored)
- [ ] Bumped the version in `package.json` (semver) if behavior changed
- [ ] Updated `README.md` / `.github/copilot-instructions.md` if structure changed
