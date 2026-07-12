# Test Plan: Configurable Git Platform CLI

## Integration Cases

- Missing configuration resolves to `Git CLI: glab` and passes.
- Configuration without `git.cli` resolves to `Git CLI: glab` and passes.
- Explicit `git.cli: glab` passes.
- Explicit `git.cli: gh` passes.
- Invalid values (for example `git.cli: git`) fail with `Invalid git.cli`.
- Duplicate `git.cli` fails with `Duplicate .ai-flow.yml key: git.cli`.
- Mis-nested `cli` outside `git` fails with malformed structure.

## Repository Checks

- The checked-in `.ai-flow.yml` passes direct validation.
- Existing language validation behavior remains unchanged.
- CI-equivalent policy checks remain green.

## Manual Review

- README setup section states that either `glab` or `gh` can be used.
- Source-of-truth AI flow configuration section includes CLI resolution and fallback.
- No policy duplication is introduced across role wrapper files.
