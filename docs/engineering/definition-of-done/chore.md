# Definition of Done: Chore

A chore is done only when:

- The change does not alter product behavior.
- The reason for the chore is documented in the issue or merge request.
- The scope is limited to maintenance, configuration, tooling, dependencies, CI, infrastructure, cleanup, or internal project hygiene.
- Any changed tooling, scripts, or configuration are verified locally or in CI.
- Dependency updates include relevant compatibility notes when needed.
- Risky changes include a rollback or recovery note.
- No unrelated product, architecture, or formatting changes are included.
- Documentation is updated if the chore changes developer workflow, setup, deployment, configuration, or operations.
- The merge request explains how the change was verified.

A work item directory is required for risky chores:

```txt
docs/work-items/NNN-chore-<short-slug>/
```

## Blocking review conditions

The merge request must not be approved until these issues are resolved:

- Product behavior changed as part of the `chore`.
- The task is actually a `refactoring`, `change-request`, or `bugfix` and was misclassified.
