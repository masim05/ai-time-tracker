# Definition of Done: Feature

A feature is done only when:

- A feature work item exists under `docs/work-items/NNN-feat-<short-slug>/`.
- Acceptance criteria are explicit and testable.
- The implementation plan exists or is included in the work item.
- Architecture impact is described, including affected modules, boundaries, and dependencies.
- The implementation follows the project architecture and does not introduce unauthorized dependencies or shortcuts.
- Edge cases and error states are considered.
- Security, privacy, performance, and observability implications are checked where relevant.
- User-facing documentation is updated when behavior changes.
- The merge request links to the feature work item.
- The merge request explains how the feature was verified.

## Blocking review conditions

The merge request must not be approved until these issues are resolved:

- Existing product code was deleted as part of a `feature` task.
- The task is actually changing an existing behavior contract and should be reclassified as `change-request`.
