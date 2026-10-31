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

- [REQ] Threads imported by Codex App from Claude Code transcripts
  (`external_agent_session_imports.json`) are kept as-is: no special
  exclusion or filtering in this work item.
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

## Out of scope

- Excluding or relabelling imported threads.
- Changes to reporter thresholds or other providers.
