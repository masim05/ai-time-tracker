# Definition of Done: Bugfix

A bugfix is done only when:

- The bug is described with actual behavior and expected behavior.
- The reproduction case is documented when possible.
- The root cause is identified, or the merge request explicitly explains why it could not be determined.
- The fix is minimal and focused on the bug.
- Existing behavior remains compatible unless the behavior change is intentional and documented.
- The original reproduction case no longer fails.
- Related edge cases are considered.
- The merge request explains how the fix was verified.

A work item directory is required for non-trivial bugfixes:

```txt
docs/work-items/NNN-bug-<short-slug>/
```

## Blocking review conditions

The merge request must not be approved until these issues are resolved:

- The change expands beyond a focused fix and is really a `change-request` or `feature`.
