# Definition of Done: Bugfix

A bugfix is done only when:

- The bug is described with actual behavior and expected behavior.
- The reproduction case is documented when possible.
- The root cause is identified, or the merge request explicitly explains why it could not be determined.
- The fix is minimal and focused on the bug.
- A regression test is added at the lowest meaningful level.
- Existing tests are not weakened to make the bugfix pass.
- If an existing test is updated, the merge request explains why a new regression test was not sufficient on its own.
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

- No regression test was added and the merge request does not explain why no practical regression test could be added.
- Existing tests were weakened to make the bugfix pass.
- The change expands beyond a focused fix and is really a `change-request` or `feature`.
