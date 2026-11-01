# Developer verification — 2026-10-31

All live checks were offline and read-only. Only structural rollout fields
(`timestamp`, `type`, `payload.type`, `payload.turn_attribution.turn_trigger`)
were inspected; no prompt, response, tool, or label content was captured.

## Provider discovery

- `state_5.sqlite` has 30 thread rows; all 30 have a `rollout_path` and every
  rollout file exists.
- 5 threads are native Codex threads and 25 are Codex App imports of Claude
  Code transcripts (`external_agent_session_imports.json`).
- Newer native rollouts carry `task_started` with
  `turn_attribution.turn_trigger: "user"` and `task_complete`; imported
  rollouts use the older shape (`task_started` + `user_message` without
  `turn_attribution`), all timestamped at import time.
- 3 native rollouts contain only `session_meta` (no turns) and use the
  log-clustering fallback.

## Regression test (fails before the fix)

`CodexReader rollout-based activity > derives agent spans and prompts from
rollout turns, not whole-thread logs (regression #17)` — on the unfixed reader
it failed (one log-cluster span covering the thread); after the fix it returns
the two turn spans and the two user-triggered `task_started` prompts, with
thread start/end unchanged.

`TimeCalculator.humanActivity for Codex rollout turns (regression #17)` uses
the same timings: the log-cluster span yields `humanMs = 0`, the rollout turn
spans yield `humanMs > 0`.

```text
npx vitest run modules/session-reader/src/infrastructure/codexReader.test.ts
before fix: 27 tests, 10 failed (all new rollout cases except the two fallback cases)
after fix:  27 tests passed
```

## Full local validation (CI checks)

```text
npm run typecheck: passed
npm test: 15 files passed, 209 tests passed
npm run build: passed
```

## E2E

Main (`9dc630c`, primary checkout, read-only) and the branch were run against
the same `~/.codex` data with a fixed `--to 2026-10-31T07:00:00Z` so ongoing
sessions do not shift between runs. Session names are redacted.

### E1 — `report -f 2026-10-28 -a codex`

| Row | main human / agent-time | branch human / agent-time |
| --- | --- | --- |
| codex-app imported thread A | 0m / 1m | 0m / 0m |
| codex-app imported thread B | 0m / 1m | 0m / 0m |
| codex-app `Show folders…` (2026-10-31 05:29, two user turns) | 0m / 1m | 1m / 0m |

Precise values for the two-turn native thread (reader + `TimeCalculator`):
main 1 span, agent 58.9 s, human 0.1 s; branch 2 spans, agent 8.1 s,
human 50.9 s.

### E2 — Unchanged columns

`agent`, `path`, `name`, `start`, `duration`, and `subagents` are identical for
all Codex rows, both for `-f 2026-10-28` (3 rows) and for the whole history
(30 rows: 26 `codex-cli`, 4 `codex-app`), compared via JSON output. Warning
counts are identical (51).

Whole-history notes (expected under the spec):

- native `codex-app` thread of 2026-10-26: prompts 3 (history) → 2 (rollout
  user turns), agent 4.2 → 3.4 min, human 0 → 0.8 min, inactive unchanged;
- native `session_meta`-only threads: unchanged (fallback);
- the 25 imported threads now report ~0 agent-time: their rollout turns are
  import-time replays lasting milliseconds, whereas main reported the
  `created_at → updated_at` span or log clusters. Imported threads are kept
  as-is per the clarified decision; no special handling was added.

### E3 — Other providers unchanged

`report -f 2026-10-28 -t 2026-10-31T07:00:00Z -a claude-cli` and
`-a copilot-cli`: table and JSON output byte-identical on main and the branch.

# Developer verification — 2026-11-01 (R8, imported threads)

Follow-up to owner review on PR #18 (`report -f 2026-10-16 -a codex -t
2026-10-31`: 13 rows, `subagents` always 0, human/agent-time 0 almost
everywhere). Offline and read-only; only `records[].imported_thread_id` and
`records[].imported_at` were read from the imports file, plus the structural
rollout fields listed above. Session names other than ticket IDs are redacted.

## Findings on live data

- `thread_spawn_edges` has 0 rows, so `subagents = 0` is correct.
- `external_agent_session_imports.json` has 50 records; 25 of the 30 threads
  are imports. Every imported rollout's turn events lie between
  `imported_at - 0.9 s` and `imported_at + 0.5 s`; the only later record in two
  of them is a `thread_settings_applied` event (no turns). No imported thread
  has post-import turns, so on live data all 25 are skipped.

## Regression tests (fail before the fix)

`CodexReader imported threads` and `CodexReader imports file access` in
`codexReader.test.ts`, run against the `b0a97c8` reader:

```text
before fix: 38 tests, 10 failed (every new case except "imports file absent",
            which asserts unchanged behaviour)
after fix:  38 tests passed
```

## Full local validation

```text
npm run typecheck: passed
npm test: 15 files passed, 220 tests passed
npm run build: passed
scripts/check-ai-flow-config.sh, tests/integration/check-ai-flow-config.sh,
scripts/check-architecture.sh, scripts/check-specs.sh, scripts/check-dod.sh,
scripts/check-pr.sh: passed
```

## E4 — `report -f 2026-10-16 -a codex -t 2026-10-31`

| | `b0a97c8` | branch |
| --- | --- | --- |
| Codex rows | 13 (11 imported threads, 2 native) | 2 native |
| native `codex-cli` thread (2026-10-22 08:08) | 0m / 0m, 0m | unchanged |
| native `codex-app` `DW-2963` (2026-10-26 07:02) | human 1m, agent-time 3m, 7h39m | unchanged |
| warnings | 49 | 25 |

The 24 fewer warnings are the latest-only name warnings of skipped imported
threads; one new warning reads `25 Codex thread(s) skipped: imported from
another agent's session history, with no Codex turns after the import`.

Native rows are identical in JSON for this window and for the whole history
(`-f 2026-01-01 -t 2026-11-01`: 30 rows → the same 5 native rows).
`claude-cli` and `copilot-cli` JSON for `-f 2026-10-16 -t 2026-10-31` is
byte-identical on `b0a97c8` and the branch.
