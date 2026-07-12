# E2E Scenarios: Prune stale local checkouts

1. A maintainer runs the cleanup script in a repository with one active MR branch and one stale branch.
2. The script removes the stale branch and its linked worktree, leaving the active branch intact.

1. A maintainer sets `git.cli: gh` in `.ai-flow.yml` and reruns the cleanup script.
2. The script uses `gh` to detect active pull requests and performs the same cleanup behavior.