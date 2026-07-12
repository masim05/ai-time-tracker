# Definition of Done: Change Request

A change request is done only when:

- A change-request work item exists under `docs/work-items/NNN-change-request-<short-slug>/`.
- The current behavior and requested behavior are both described explicitly.
- Acceptance criteria are explicit and testable.
- The implementation plan exists or is included in the work item.
- Architecture impact is described, including affected modules, boundaries, and dependencies.
- The implementation follows the project architecture and does not introduce unauthorized dependencies or shortcuts.
- Edge cases and error states are considered.
- Security, privacy, performance, and observability implications are checked where relevant.
- User-facing documentation is updated when behavior changes.
- The merge request links to the change-request work item.
- The merge request explains what behavior changed and how it was verified.

## Blocking review conditions

The merge request must not be approved until these issues are resolved:

- The change is actually additive-only and should be reclassified as `feature`.
