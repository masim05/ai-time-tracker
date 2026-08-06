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
  - collapses newlines and tabs in the extracted name to single spaces;
  - ignores `local_command` records for other commands, the
    `<local-command-stdout>` record a rename writes after itself, sidechain and
    meta records, and a non-rename command whose own arguments quote a rename
    block;
  - ignores a `/rename` with an empty argument, a whitespace-only argument, or
    no `<command-args>` tag at all, emitting a content-free warning diagnostic
    for each;
  - skips a `local_command` record whose `content` is not a string, without a
    diagnostic;
  - a rename record replayed into a resumed launch is attributed to the launch
    that recorded it first;
  - a resumed launch that recorded a rename of its own reports that rename
    history rather than its `custom-title`, with `hasApproximateNameHistory`
    false and no latest-only warning, while the original keeps the rename it
    recorded first;
  - `custom-title` fallback: a launch that recorded no `/rename` of its own
    reports the **last** `custom-title` value from its launch start, sets
    `hasApproximateNameHistory`, and emits the same latest-only warning the
    Copilot and Codex readers emit;
  - the fallback applies to the launch root only, not to the extra
    working-directory segments of a multi-segment launch;
  - recorded rename history wins over `custom-title` when both are present, with
    no latest-only warning for that launch;
  - an empty or whitespace-only `customTitle` yields no name and the existing
    empty-metadata warning; a non-string `customTitle` is skipped silently;
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
