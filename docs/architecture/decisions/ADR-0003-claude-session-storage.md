# ADR-0003 — Claude Code session storage and identity

Status: accepted
Date: 2026-08-02
Context: [issue #5](https://github.com/masim05/ai-time-tracker/issues/5),
work item `docs/work-items/010-feat-claude-code-support/`
Supersedes nothing. Extends [ADR-0002](ADR-0002-session-storage-formats.md) with
the third provider.

## Context

Claude Code stores its history locally, but no documented schema exists. The
report needs launch identity, prompt and response timestamps, working
directories, sub-agent relationships, and an active-session signal. Full
evidence is recorded in the work item's `artifacts/discovery-gate.md`.

## Decisions

### 1. Sources

| Source | Use |
| --- | --- |
| `~/.claude/projects/<slug>/<sessionId>.jsonl` | Launch transcript; one record per line. |
| `~/.claude/projects/<slug>/<sessionId>/subagents/agent-<id>.jsonl` | Sub-agent transcript. |
| `~/.claude/sessions/<pid>.json` | Live-launch registry. |

The layout is identical on Linux and macOS; only `$HOME` differs. A missing
`~/.claude` produces no rows and no diagnostic.

### 2. Only `entrypoint: cli` is reported

`entrypoint` identifies the driver. `cli` covers developer-invoked Claude Code,
including its background jobs (`sessionKind: bg`). Any other value marks an
embedded Agent SDK host — on the reference machine, a Slack bot spawning one
headless session per user question, which #3 excludes as a "Slack or CI agent".
Those sessions are skipped and reported as one aggregated warning carrying a
count, never dropped silently.

Rejected alternative: report every Claude-driven session. It would make 98% of
Claude launches product traffic rather than developer time.

### 3. One transcript file is one launch, deduplicated by record `uuid`

Resuming writes a **new** `sessionId` file that replays the earlier launch's
records with identical `uuid` and `timestamp`. Launches are therefore processed
oldest first — ties broken by last timestamp, then session id — and each `uuid`
is attributed to the first launch that recorded it. A launch left with no own
records is dropped as empty.

Invocation boundaries inside one transcript are never inferred from inactivity
gaps, per the #3 rule. Evidence supports one file per launch: no sampled
transcript mixes two `version` values, and long internal gaps are rare.

### 4. Prompt and activity classification

A human prompt is a `type: "user"` record that is not a sidechain, not
`isMeta`, carries no `toolUseResult` / `sourceToolAssistantUUID` /
`sourceToolUseID`, and whose `promptSource` is absent or `typed`, `queued`, or
`suggestion_accepted`. `system` marks injected notifications and command output;
`sdk` marks programmatic prompts. Agent activity is an `assistant` record or a
`user` record carrying `toolUseResult`.

A span runs from a prompt to the last agent activity before the next prompt, so
cancellations and interruptions count through their last recorded activity and a
prompt with no response yields a zero-length span. A span crossing a directory
change is split at the boundary (see decision 5), so the time is attributed to
the directory the work was recorded in rather than to the one the prompt came
from.

### 5. Working directories become launch segments

Conversation records carry `cwd`, and 58% of local CLI launches change it
(worktree switching). Consecutive records sharing a `cwd` form a segment: the
first is the launch root, later ones are non-root invocations parented to it, so
the existing grouping service absorbs descendants and gives unrelated
directories their own row. Metadata records without a `cwd` (for example
`file-history-delta`) continue the current segment; treating them as a directory
change would create spurious `unknown` rows.

Because these segments are not sub-agents, `NormalizedInvocation` gained an
optional `isSubagent` marker. Readers that omit it keep the previous
"every non-root invocation is a sub-agent" behavior, so Codex and Copilot output
is unchanged.

### 6. Active detection uses the live-session registry plus a liveness probe

A launch is active when some `sessions/<pid>.json` names its `sessionId`, that
process is alive (signal `0`, which delivers nothing), and the recorded
`procStart` matches field 22 of `/proc/<pid>/stat`. The `procStart` comparison
guards against pid reuse; where procfs is unavailable (macOS) liveness alone
decides. All registry entries for a session are kept, so a stale file from a
crashed process cannot mask the live one. Only the last segment of an active
launch has an open end.

Rejected alternative: a recency window over the last record. Local evidence
included genuinely open sessions idle for a month, which a window would report
as finished.

## Consequences

- Claude parsing stays entirely inside one infrastructure adapter; the
  provider-neutral model gained one optional field and one interface value.
- `claude-app` and `claude-vsc` remain unsupported until their storage can be
  observed; they are rejected as filter values rather than returning empty.
- If a future Claude Code release changes `entrypoint` values or moves
  sub-agent transcripts, only this adapter and this ADR need revision.
