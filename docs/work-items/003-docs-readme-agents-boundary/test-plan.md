# Test Plan: README And AGENTS Audience Boundary

## Automated Checks

- Run `scripts/check-architecture.sh`.
- Run `scripts/check-specs.sh`.
- Run `scripts/check-dod.sh`.
- Run `scripts/check-pr.sh`.
- Run `git diff --check`.

## Manual Checks

- Verify README headings follow the intended human reading order.
- Verify all paths and commands in README and AGENTS exist.
- Verify AGENTS references README for shared workflow without copying its steps.
- Search README and AGENTS for duplicate worktree, work-item, validation, and GitLab CI instructions.

## E2E Coverage

No E2E scenario is required because this task changes documentation structure only and does not affect executable or user-visible application behavior.