# 016 — bug: human time is always 0m for Codex sessions

Issue: [masim05/ai-time-tracker#17](https://github.com/masim05/ai-time-tracker/issues/17)

## Task type

`bug`

## Actual behavior

On `main` at `9dc630c`:

```
$ npm run cli -- report -f 2026-10-28 | grep codex
codex-app   engineering-harness  DW-2897              0m          1m  2026-10-28 00:00  2d13h57m  0
codex-app   engineering-harness  php-reco-rewrite     0m          1m  2026-10-28 00:00  2d13h57m  0
codex-app   engineering-harness  Show folders th…     0m          1m  2026-10-31 05:29        1m  0
```

- The `human` column is `0m` for Codex rows, including launches with real
  human prompts and idle time between agent turns.
- `agent-time` for Codex is over-reported for short interactive sessions.

## Expected behavior

- Codex `human` time follows the same reporter rules as other providers
  (`TimeCalculator.humanActivity`): the idle interval before each human prompt
  is human-active when it is within the threshold and does not overlap agent
  activity.
- Codex agent-active spans cover the time the agent was actually running a
  turn, not every moment the Codex process wrote a log line.

## Root cause

`CodexReader` derives agent spans by clustering **every** `logs_2.sqlite` row
for a thread with a 2-minute idle gap. Codex (especially the App server) writes
log rows continuously while a thread is open, including while waiting for the
user. The resulting span covers the whole thread, so
`TimeCalculator.humanActivity` subtracts all idle time as "agent active" and
human time is always 0.

Example (sanitized timing for the `Show folders…` thread):

| Event | Time (UTC) |
| --- | --- |
| thread created / first log row | 05:29:50 |
| turn 1 `task_started` (trigger `user`) | 05:30:16.7 |
| turn 1 `task_complete` | 05:30:19.9 |
| turn 2 `task_started` (trigger `user`) | 05:30:44.4 |
| turn 2 `task_complete` | 05:30:49.2 |
| last log row | 05:30:49 |

Actual agent work is about 8 s; human idle time about 50 s. Log clustering
yields one 59 s span, so human time is 0.

Additionally, Codex App threads may have no entries in `history.jsonl` (the
current, only prompt source), so they can have no prompts at all.

## Provider discovery

Each `threads` row in `state_5.sqlite` has `rollout_path`, a JSONL transcript
per thread. Relevant record shapes (only these fields may be read):

- `{"timestamp": "<ISO-8601>", "type": "event_msg", "payload": {"type": "task_started", "turn_attribution": {"turn_trigger": "user" | …}}}`
  — a turn starts. Newer Codex versions include `turn_attribution`; older ones
  omit it.
- `{"timestamp": …, "type": "event_msg", "payload": {"type": "task_complete"}}`
  — the turn ends. `turn_aborted` (when present) also ends a turn.
- `{"timestamp": …, "type": "event_msg", "payload": {"type": "user_message"}}`
  — older-format human prompt event.
- Some rollouts contain only `session_meta` (no turns).

## Clarified decisions

- [REQ] ~~Threads imported by Codex App from Claude Code transcripts
  (`external_agent_session_imports.json`) are kept as-is.~~ Superseded after
  owner review on PR #18: imported threads are skipped from their import replay
  (R8). Their rollouts replay the whole external history within about a second
  of the import, so they reported day-long durations with ~0 agent-time on the
  branch (and log-clustered agent-time on `main`), and that work is already
  counted by the source provider (for example `claude-cli`).
- [TECH] Agent spans come from rollout turns: each `task_started` up to the
  next `task_complete`/`turn_aborted`. Fall back to the existing
  `logs_2.sqlite` clustering only when the rollout is missing, unreadable, or
  has no turn records.
- [TECH] Prompts come from the rollout: the timestamp of each `task_started`
  whose `turn_attribution.turn_trigger` is `"user"`; for turns without
  `turn_attribution`, the timestamp of the `user_message` event within that
  turn. Fall back to `history.jsonl` only when the rollout yields no prompts.
  Sub-agent threads keep reporting no prompts.

## Requirements

1. R1 — Rollout agent spans: spans are `[task_started, task_complete|turn_aborted]`.
   An unterminated final turn ends at the last record timestamp in the rollout
   (or `thread.updated_at_ms` if later records have no timestamp).
2. R2 — Rollout prompts as described above; deduplicated and sorted.
3. R3 — Fallbacks: missing/unreadable rollout → existing log clustering and
   `history.jsonl` prompts; a content-free warning diagnostic is emitted for an
   unreadable or missing rollout file; malformed lines produce content-free
   warnings and are skipped.
4. R4 — `codex-app`/`codex-cli` classification, topology, names, `start`, and
   `duration` are unchanged (thread start/end still include log activity).
5. R5 — Privacy: only `timestamp`, `type`, `payload.type`, and
   `payload.turn_attribution.turn_trigger` are read; no prompt, response, or
   tool content is stored, logged, or emitted in diagnostics.
6. R6 — Read-only access; no new dependencies.
7. R7 — ADR-0002 is updated to describe rollout-based activity and prompts.
8. R8 — Imported threads. A thread whose id is an `imported_thread_id` in
   `~/.codex/external_agent_session_imports.json` is not reported from its
   import replay:
   - **Post-import rule:** a rollout turn event counts only when its timestamp
     is later than `imported_at * 1000 + 60 000` ms (`imported_at` is in
     seconds; replay events are stamped within about a second of it). Events at
     or before that cutoff are replay and ignored. When a thread is imported
     more than once, the latest `imported_at` applies, whatever the record
     order; if any of its records has no numeric `imported_at`, the import
     time is unknown and the thread is skipped (as below).
   - With at least one post-import turn, the thread reports only those turns:
     agent spans and prompts per R1/R2 from post-import events, `start` = the
     first post-import turn start, end = the last post-import turn end. Thread
     `created_at`/`updated_at`, log rows, and `history.jsonl` are not used.
   - Without post-import turns (or when the record has no numeric
     `imported_at`), the thread is skipped. Skipped threads are reported as one
     counted warning (`N Codex thread(s) skipped: …`, with the imports file
     path), never silently dropped.
   - Only `records[].imported_thread_id` and `records[].imported_at` are read;
     `source_path`, titles, and source transcripts are never read or emitted.
     Records without a thread id are ignored with a counted warning.
   - Absent imports file: no imports known, no warning. Unreadable or
     malformed file (not JSON, no `records` array): no imports known plus one
     content-free warning.
   - Sub-agent threads of a skipped imported thread are read as usual (unless
     they are imported themselves) and keep the imported thread as their launch
     root, so they form a launch row without the root's activity — the existing
     grouping for a launch whose root invocation is absent.
   - Classification, names, native threads, and other providers are unchanged.

## Out of scope

- Relabelling imported threads or attributing their history to the source
  provider.
- Changes to reporter thresholds or other providers.
