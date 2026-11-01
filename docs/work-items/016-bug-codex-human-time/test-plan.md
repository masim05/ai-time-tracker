# Test plan — 016 bug: Codex human time

## Traceability

| Requirement | Evidence |
| --- | --- |
| R1 rollout agent spans | Codex reader unit tests + E1 |
| R2 rollout prompts (new + old format) | Codex reader unit tests + E1 |
| R3 fallbacks and diagnostics | Codex reader unit tests |
| R4 unchanged classification/start/duration | Existing tests + E2 |
| R5 privacy | Diagnostic assertions (no fixture content in output) |
| R6 read-only / no deps | Review + `package.json` diff |
| R7 ADR updated | Review |
| R8 imported threads | `CodexReader imported threads` unit tests + E4 |
| End-to-end human time > 0 | E1 |

## Required regression test

A sanitized fixture where `logs_2.sqlite` rows cover the full thread but the
rollout has two user turns separated by idle time. On `main` the reader yields
one long span and the reporter computes `humanMs = 0`; after the fix it yields
two turn spans, and `TimeCalculator.humanActivity` on the reader output returns
`humanMs > 0`.

## Automated tests (`codexReader.test.ts`)

- spans from `task_started` → `task_complete` pairs;
- `turn_aborted` ends a turn;
- unterminated final turn ends at the last record timestamp;
- prompts from `turn_trigger: "user"`; non-user triggers are not prompts;
- older format: `user_message` events are prompts when `turn_attribution` is absent;
- rollout without turns → log-clustering spans and `history.jsonl` prompts;
- missing rollout file → fallback + content-free warning;
- malformed rollout line → skipped + content-free warning;
- older schema without `rollout_path` column → existing behavior;
- sub-agent threads still have no prompts;
- diagnostics never contain fixture prompt text.

### Imported threads (R8, fail on `b0a97c8`)

- replay-only imported threads are skipped; one counted warning with the
  imports file path; no source path/title in diagnostics; native thread
  unchanged;
- imported thread with post-import turns reports only those turns, with
  start/end from them;
- replay tolerance boundary: event at `imported_at + 60 s` is replay, 1 ms
  later is post-import;
- record without numeric `imported_at` → thread skipped;
- sub-agent of a skipped import keeps the imported launch root;
- malformed imports file (not JSON, `records` not an array, top level not an
  object) and unreadable file → threads as before + one content-free warning;
- records without a thread id → ignored with a counted warning;
- absent imports file → threads as before, no warning (passes before and after).

## Commands

```bash
npm run typecheck
npm test
npm run build
```
