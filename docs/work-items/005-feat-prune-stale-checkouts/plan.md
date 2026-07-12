# Plan: Prune stale local checkouts

**Goal:** Add a local cleanup helper for stale branches and worktrees using the configured Git platform CLI.

## Task 1: Script Implementation

- Add a shell script in `scripts/`.
- Resolve the configured Git CLI from the AI flow config.
- List local branches and linked worktrees.
- Check each branch against the remote MR/PR list.
- Remove stale worktrees and delete stale branches.

## Task 2: Integration Coverage

- Add a shell integration test under `tests/integration/`.
- Cover default `glab` behavior and explicit `gh` behavior.
- Verify active branches are preserved and stale branches are removed.

## Task 3: Artifact Tracking

- Add the work-item artifacts required by the repository flow.
- Keep the implementation notes and verification evidence in the work-item directory.