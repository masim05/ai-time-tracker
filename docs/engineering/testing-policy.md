# Testing Policy

This document defines the testing expectations for the `ai-time-tracker` project.

## Test framework

- Unit and integration tests use [Vitest](https://vitest.dev/).
- Run the full suite with `npm test` (`vitest run`).
- Run in watch mode with `npm run test:watch`.

## Test placement (colocation)

- Unit and component tests are **colocated** with the code they cover, using the
  `*.test.ts` suffix next to the module under test (for example
  `modules/reporter/src/application/timeCalculator.ts` is covered by
  `modules/reporter/src/application/timeCalculator.test.ts`).
- Centralized `tests/unit/` and `tests/component/` directories are **not allowed**
  (enforced by `scripts/check-architecture.sh`).
- Repository-policy integration checks and end-to-end shell scenarios live under
  `tests/integration/` and `tests/e2e/`.

## What to test at which layer

- `domain/` and `application/` layers are pure and MUST be covered by fast,
  deterministic unit tests with no file system, SQLite, network, or clock access.
- `infrastructure/` readers are covered with **sanitized fixtures** committed under
  `__fixtures__/` directories. Fixtures MUST NOT contain real prompts, responses,
  source code, or any other session content — only structural metadata and
  timestamps required to exercise parsing and time-calculation logic.
- `cli/` formatters and the command wiring are covered by unit tests that assert on
  rendered output and exit-code behavior.

## Test data and privacy

- Never commit real session content. Fixtures are hand-authored, minimal, and
  sanitized.
- Live end-to-end validation against real local Codex/Copilot data is manual,
  read-only, and its recorded evidence (`docs/work-items/*/artifacts/`) MUST contain
  only counts, commands, and warnings — never session content.

## Coverage expectations

- Every behavior described in a work item's `test-plan.md` has at least one
  corresponding automated test at the lowest meaningful level.
- Bug fixes add a regression test that fails before the fix and passes after it.
