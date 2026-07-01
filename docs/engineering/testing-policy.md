# Testing Policy

This document defines test levels, test placement, and task-type-specific change rules.

## Unit tests

Unit tests verify small units of behavior such as functions, classes, or isolated modules.

Unit tests must live next to the code they test.

Preferred pattern:

```txt
src/module/file.ts
src/module/file.test.ts
```

Do not place unit tests in a centralized `tests/unit/` directory.

## Component tests

Component tests verify UI components or isolated modules at the component boundary.

Component tests must live next to the component or module they test.

Preferred pattern:

```txt
src/module/component.tsx
src/module/component.test.tsx
```

Do not place component tests in a centralized `tests/component/` directory.

## Integration tests

Integration tests verify behavior that spans multiple modules, adapters, services, or architectural boundaries without necessarily running the full user-visible system.

Integration tests live in:

```txt
tests/integration/
```

Use integration tests when the behavior cannot be meaningfully validated by a colocated unit or component test.

## E2E tests

E2E tests verify full user-visible or system-visible flows.

E2E tests live in:

```txt
tests/e2e/
```

Use E2E tests for:

- critical happy paths;
- high-risk user-visible flows;
- important production-like integrations;
- regressions that cannot be covered at a lower level.

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

## General rules

- Prefer the lowest meaningful test level.
- Do not add brittle E2E coverage for behavior that can be tested more reliably at a lower level.
- If tests are not added, explain why in the merge request.
