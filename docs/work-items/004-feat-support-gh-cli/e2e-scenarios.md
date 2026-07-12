# E2E Scenarios: Configurable Git Platform CLI

## Explicit GitHub CLI Selection

1. A maintainer sets `git.cli: gh` in `.ai-flow.yml`.
2. The configuration validator passes.
3. AI flow starts from a supported wrapper.
4. The flow resolves Git CLI as `gh` and uses it for Git platform operations.

## Backward-Compatible Default

1. A repository does not define `git.cli`.
2. The configuration validator passes.
3. AI flow resolves Git CLI as `glab` by default.
4. Existing repositories keep previous behavior without extra migration work.
