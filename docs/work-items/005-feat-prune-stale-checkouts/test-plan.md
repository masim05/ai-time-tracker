# Test Plan: Prune stale local checkouts

## Integration Cases

- Missing config resolves to `glab` and the script uses the `glab` path.
- Explicit `git.cli: gh` resolves to `gh` and the script uses the `gh` path.
- A branch with an active remote MR/PR is preserved.
- A stale branch with no active remote MR/PR is deleted.
- A stale linked worktree is removed before its branch is deleted.
- The current branch is skipped even if it is stale.

## Verification

- The cleanup script executes without shell errors.
- The repo worktree layout is unchanged for active branches.
- The script honors the existing AI flow config validation contract.