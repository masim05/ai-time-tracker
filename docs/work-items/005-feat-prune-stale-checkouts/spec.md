# Spec: Prune stale local checkouts

## Goal

Provide a shell script that removes local branches and worktrees whose branches do not have an active remote merge request or pull request.

## Behavior

- The script resolves the Git platform CLI from `.ai-flow.yml` using the existing AI flow configuration contract.
- Supported CLIs are `glab` and `gh`.
- If no active MR/PR exists for a local branch, the branch is removed after any linked worktree is removed.
- The current branch and default branch are preserved.
- The script stops if AI flow config validation fails.

## Acceptance Criteria

- The script lives under `scripts/`.
- It works with both `glab` and `gh`.
- It removes stale worktrees before deleting their branches.
- It does not delete branches that still have active remote MRs/PRs.
- The current branch is not deleted while checked out.

## Out Of Scope

- Changing repository AI flow policy.
- Adding GitLab/GitHub workflow automation.
- Deleting untracked files or local changes.