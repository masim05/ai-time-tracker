# Developer verification — 2026-08-06

All live checks were offline and read-only. No persisted label or conversation
content was captured.

## Provider discovery

- `state_5.sqlite` exposes both `threads.name` and `threads.title`.
- 22 thread rows were present on the development server.
- 0 rows had a nonblank explicit name.
- 15 rows had a nonblank provider-generated title.
- 15 rows required the generated-title fallback.

## Automated regression

```text
npm test -- modules/session-reader/src/infrastructure/codexReader.test.ts modules/reporter/src/cli/reportCommand.test.ts
2 files passed, 28 tests passed
```

The focused cases cover CLI and App titles, explicit-name precedence,
whitespace normalization and fallback, ordinary-message non-inference, root
only attribution, latest-value warnings, unnamed sessions, and compatibility
with a state database that lacks the optional `title` column. They also verify
that unsupported non-string explicit names and generated titles produce error
diagnostics without exposing their values, and that these errors preserve valid
report output while producing exit code `1`. Blank and whitespace-only strings
remain warning diagnostics.

## Live report verification

- `codex-cli`: 3 rows, all 3 had provider-persisted labels.
- `codex-app`: 5 rows, all 5 had provider-persisted labels.
- Table, JSON, and CSV commands completed successfully with non-empty output.
- Verbose JSON completed successfully; diagnostics contained none of the
  persisted names or titles from the state database.

The counts reflect the available development-server data at verification time
and intentionally omit all real label values.

## Full local validation

```text
npm run typecheck: passed
npm test: 15 files passed, 179 tests passed
npm run build: passed
scripts/check-ai-flow-config.sh: passed
tests/integration/check-ai-flow-config.sh: passed
scripts/check-architecture.sh: passed
scripts/check-specs.sh: passed
scripts/check-dod.sh: passed
scripts/check-pr.sh: passed
```

## Review follow-up: table name width

- Table names longer than 12 characters render as the first 11 characters plus
  an ellipsis, for a maximum of 12 displayed characters.
- Names of 12 or fewer characters remain unchanged.
- JSON and CSV retain the complete persisted label.
- Focused formatter suite: 15 tests passed.
- Full suite, typecheck, build, all repository policy checks, and
  `git diff --check` passed after the review fix.
