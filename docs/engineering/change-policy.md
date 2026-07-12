# Change Policy

This document defines task-type change boundaries and review-blocking rules.

## Task-type Change Matrix

| Task type | Code | Existing tests | New tests | Infrastructure / CI / config | Documentation |
| --- | --- | --- | --- | --- | --- |
| `feature` | May add and modify code within the new capability scope. Must not delete existing product code. | Must not change existing tests. If existing tests are changed, review is blocked pending explicit discussion and reclassification if needed. | Add tests for the new behavior at the lowest meaningful level. | May change only if required to support the new feature and included in scope. Must not delete existing infrastructure as part of an additive feature. | Update when behavior changes. |
| `change-request` | May add, modify, or remove code where the existing behavior contract intentionally changes. | May change only the tests whose covered behavior contract intentionally changes. Unrelated tests must not be rewritten or weakened. | Add tests when needed to cover the changed behavior clearly. | May change when required by the changed behavior. | Update to describe the new behavior and remove obsolete descriptions of the old behavior. |
| `bugfix` | May change code only in the scope of the fix. | Must not weaken existing tests to make the fix pass. | Add a regression test that fails before the fix and passes after it whenever practical. | May change if the root cause is in configuration or infrastructure. | Update if the bug affected user-facing or operational behavior. |
| `chore` | May change maintenance, tooling, dependency, CI, infrastructure, or internal hygiene code only. Must not change product behavior. | Must not change behavior-level assertions. Minimal harness, setup, or tooling adjustments are allowed only when required by the chore. | Add only technical coverage when needed for the chore itself. | This is the primary allowed change area. | Update when developer workflow, setup, deployment, configuration, or operations change. |
| `docs` | Must not change code. | Must not change tests. | Must not add tests. | Must not change infrastructure, CI, or configuration. | This is the only allowed change area. |

## Review-blocking rules

The following findings are blocking in code review:

- A `feature` changes any existing test file without explicit prior agreement and a clear justification in the merge request.
- A `bugfix` does not include a regression test, unless the merge request explains why no practical regression test could be added.
- A `change-request` changes tests outside the behavior contract that intentionally changed.
- A `chore` changes behavior-level test assertions or changes product behavior.
- A `docs` task changes code, tests, infrastructure, CI, or configuration.
