# ADR-0002: Local Session Storage Formats for the Cross-Agent Report

## Status

Accepted

## Context

The cross-agent session activity report (work item
`009-feat-cross-agent-report`) reads local, on-disk artifacts produced by
GitHub Copilot CLI and Codex (CLI and App) to compute agent-time,
human-active, inactive, and elapsed time. The concrete storage formats are
undocumented, provider-specific, and differ between the two providers. The
reader must normalize them into a single provider-neutral model without
depending on any provider SDK or network access.

Several material decisions were required about **which** files to read and
**how** to derive timing information from them, because more than one source
exists per provider and some expected sources are empty in practice.

## Decision

### Copilot CLI: read `events.jsonl`, not `session-store.db`

Copilot CLI persists each session under
`~/.copilot/session-state/<uuid>/`. Timing is derived from the
newline-delimited `events.jsonl` event log rather than any SQLite
`session-store.db`, because the event log is the authoritative, append-only
record of `session.start`, `user.message`, `assistant.turn_start`/
`assistant.turn_end`, `tool.execution_start`/`tool.execution_complete`
(including a `success` flag), `subagent.started`/`subagent.completed`, and
`abort` events. `workspace.yaml` in the same directory supplies the working
directory (`cwd`).

### Copilot CLI: active-session detection via lock file with a recency guard

A session is treated as still active (open-ended `end`) only when an
`inuse.*.lock` file is present **and** the newest event timestamp is within a
short recency window (`ACTIVE_RECENCY_MS`, 10 minutes). Stale lock files left
behind by interrupted sessions would otherwise inflate `elapsed` to days; the
recency guard bounds that risk.

### Codex: `state_5.sqlite` for topology and cwd, rollouts for turns, `logs_2.sqlite` for extent

Codex thread topology (`threads`, `thread_spawn_edges`) and per-thread `cwd`
come from `~/.codex/state_5.sqlite`. Each thread's `threads.rollout_path`
points at a rollout JSONL transcript that supplies turn-based agent activity
and human prompts. Per-thread log timestamps from the `logs` table in
`~/.codex/logs_2.sqlite` still define thread start/end (together with
`threads.created_at_ms`/`updated_at_ms`) and app detection.
`~/.codex/history.jsonl` (`session_id` maps to a thread id, `ts` in seconds)
is a fallback prompt source.

### Codex: agent-time and prompts from rollout turns

Codex (especially the App server) writes `logs` rows continuously while a
thread is open, including while waiting for the user, so log activity cannot
separate agent work from human idle time. Agent spans are therefore derived
from rollout turn records: each `event_msg` `task_started` up to the next
`task_complete` or `turn_aborted`. An unterminated final turn ends at the last
record timestamp, or at `threads.updated_at_ms` when later records carry no
timestamp.

Prompts are the timestamps of `task_started` events whose
`payload.turn_attribution.turn_trigger` is `"user"`. For older rollouts whose
turns carry no `turn_attribution`, the `user_message` event inside a turn is
the prompt. Sub-agent threads report no prompts.

Only `timestamp`, `type`, `payload.type`, and
`payload.turn_attribution.turn_trigger` are read from rollout records; no
prompt, response, or tool content is retained or emitted in diagnostics.

### Codex: fallbacks when rollout data is unavailable

`~/.codex/goals_1.sqlite`'s `thread_goals` table (which could provide
`time_used_seconds`) is empty in practice, so it cannot be used. When a thread
has no `rollout_path` (including older schemas without the column), its
rollout file is missing or unreadable, or the rollout contains no turn
records, agent-time is approximated by **clustering** that thread's `logs`
timestamps into active spans, splitting on gaps larger than a fixed threshold.
When the rollout yields no prompts, prompts come from `history.jsonl`. A
missing or unreadable rollout file and each malformed rollout line produce
content-free warning diagnostics.

### Codex: threads imported from other agents

The Codex App can import another agent's transcripts (for example Claude Code)
as Codex threads; `~/.codex/external_agent_session_imports.json` lists them as
`records[]` with `imported_thread_id` and `imported_at` (Unix seconds). The
imported rollout replays the whole external history with every turn event
stamped within about a second of the import, and that work is already reported
by the source provider. The reader therefore ignores turn events at or before
`imported_at * 1000 + 60 000` ms (latest import wins on re-import; a record
without a numeric `imported_at` makes the import time unknown). An
imported thread with later turns reports only those turns, with start and end
taken from them rather than from thread metadata or logs; otherwise, or when
its import time is unknown, it is
skipped and counted in one warning diagnostic. Only `imported_thread_id` and
`imported_at` are read from the file. An absent file means no imports; an
unreadable or malformed file yields one content-free warning and no imports.

### Codex App vs Codex CLI: detect via app-server log targets

`codex-app` and `codex-cli` share the same on-disk stores. A thread is
attributed to `codex-app` when its `process_uuid` emitted at least one `logs`
row whose `target` starts with `codex_app_server::`; otherwise it is
`codex-cli`.

### Codex session labels: latest explicit name, then generated title

Codex persists latest-only thread labels in `state_5.sqlite`: `threads.name`
contains an explicit user-assigned name and `threads.title` contains a
provider-generated title. The reader trims both values and prefers a non-empty
`name`; otherwise it uses a non-empty `title`. Because the store does not
provide timestamped naming history, the selected label applies from launch
start and is marked as approximate. Older compatible databases without the
optional `title` column continue to use `name` only.

## Consequences

- The reader depends on undocumented provider formats and may need updates if
  providers change their storage layout; parsing failures are surfaced as
  non-fatal diagnostics (partial-failure exit code `1`) rather than crashes.
- Codex agent-time follows rollout turn boundaries; it falls back to an
  approximation derived from log activity (with the clustering gap threshold as
  the main tuning parameter) only when rollout turns are unavailable.
- Imported Codex threads are visible only through their post-import turns; a
  real Codex turn within 60 s of an import would be treated as replay.
- Codex historical label changes cannot be reconstructed from the supported
  state database; only the latest explicit name or generated title is available.
- All access is read-only and offline, satisfying the security constraints of
  the work item (no prompts, responses, source code, or tool output are read
  into diagnostics).
