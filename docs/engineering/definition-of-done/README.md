# Definition of Done

This directory defines what “done” means for different task types.

Every task must satisfy the common Definition of Done in this file and the task-specific Definition of Done:

- `feature.md`
- `change-request.md`
- `bugfix.md`
- `chore.md`
- `docs.md`

## Common Definition of Done

A task is done only when:

- The task type is explicit: `feature`, `change-request`, `bugfix`, `chore`, or `docs`.
- The change is understandable from the issue, work item, or merge request description.
- The implementation follows the project architecture and boundaries.
- When the workflow or task required isolated execution, the work was carried out from the dedicated git worktree under `tmp/wts/` rather than from the primary checkout.
- The change is limited to the stated scope.
- The local CI-equivalent checks were run before push.
- The pushed commit's GitLab CI is green.
- No unrelated refactoring, formatting, or behavior changes are included.
- Documentation is updated when behavior, architecture, public API, configuration, or operational process changes.
- The merge request description explains what changed and how it was verified.

## Task Type Selection

Use `feature` when the change adds a new capability without changing the existing behavior contract.

Use `change-request` when the change intentionally modifies existing product or system behavior according to a new requirement.

Use `bugfix` when the change fixes behavior that is incorrect, broken, or inconsistent with expectations.

Use `chore` when the change is technical maintenance and does not change product behavior.

Use `docs` when the change only updates documentation.
