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

### Codex: `state_5.sqlite` for topology and cwd, `logs_2.sqlite` for activity

Codex thread topology (`threads`, `thread_spawn_edges`) and per-thread `cwd`
come from `~/.codex/state_5.sqlite`. Per-thread activity timestamps come from
the `logs` table in `~/.codex/logs_2.sqlite`. User prompt timestamps come from
`~/.codex/history.jsonl` (`session_id` maps to a thread id, `ts` in seconds).

### Codex: agent-time via log-timestamp clustering (thread_goals is empty)

`~/.codex/goals_1.sqlite`'s `thread_goals` table (which could provide
`time_used_seconds`) is empty in practice, so it cannot be used. Instead,
agent-time per thread is approximated by **clustering** that thread's `logs`
timestamps into active spans, splitting on gaps larger than a fixed threshold.
This is a deliberate approximation and is documented as such.

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
- Codex agent-time is an approximation derived from log activity, not an exact
  provider-reported duration; the clustering gap threshold is the main tuning
  parameter.
- Codex historical label changes cannot be reconstructed from the supported
  state database; only the latest explicit name or generated title is available.
- All access is read-only and offline, satisfying the security constraints of
  the work item (no prompts, responses, source code, or tool output are read
  into diagnostics).
