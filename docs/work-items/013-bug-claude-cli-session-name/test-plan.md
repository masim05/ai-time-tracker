# Test plan — 013 bug: `claude-cli` session name

## Regression test (required)

`modules/session-reader/src/infrastructure/claudeCliReader.test.ts` must contain
a case that fails on `main` and passes after the fix: a launch whose transcript
holds `system` / `local_command` `/rename` records yields the matching
`sessionNameEvents` with the record timestamps.

## Automated tests

- `modules/session-reader/src/infrastructure/claudeCliReader.test.ts`
  - extracts one `SessionNameEvent` per `/rename` record, in chronological
    order, with the record timestamp;
  - ignores `local_command` records for other commands;
  - ignores a `/rename` with an empty or whitespace-only argument and emits a
    content-free warning diagnostic;
  - a rename record replayed into a resumed launch is attributed to the launch
    that recorded it first;
  - existing prompt-counting, span, cwd-segmentation, sub-agent, and
    entrypoint-skipping assertions still pass against the rewritten fixtures.
- `modules/reporter/src/application/groupingService.test.ts`
  - unchanged; confirms the splitting contract this fix feeds into.
- `modules/reporter/src/cli/formatters.test.ts`
  - unchanged; confirms the `-` / `null` / empty rendering contract for launches
    that stay unnamed.

## Manual verification

Run the issue reproduction against live local data before and after the fix and
store both outputs under `artifacts/`.

## Repository checks

```bash
npm run typecheck
npm test
npm run build
bash scripts/check-ai-flow-config.sh
bash tests/integration/check-ai-flow-config.sh
bash scripts/check-architecture.sh
bash scripts/check-specs.sh
bash scripts/check-dod.sh
bash scripts/check-pr.sh
```
