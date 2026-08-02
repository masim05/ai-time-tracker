# 010 — feat: Claude Code support in the cross-agent session activity report

Issue: [masim05/ai-time-tracker#5](https://github.com/masim05/ai-time-tracker/issues/5)
Predecessor: [#3](https://github.com/masim05/ai-time-tracker/issues/3) / [PR #4](https://github.com/masim05/ai-time-tracker/pull/4) (`009-feat-cross-agent-report`)

## Problem

Issue #3 requires eight agent interfaces. The delivered report covers three
(`copilot-cli`, `codex-cli`, `codex-app`). Claude Code activity is invisible, so
every developer who works through Claude Code is under-reported.

## Goal

Add Claude Code as a first-class source of the existing report: same options,
grouping, time calculations, output formats, diagnostics, and exit codes. No new
report semantics, no new CLI options, no changes to Codex/Copilot behavior.

## Discovery gate result

Full evidence and method: [`artifacts/discovery-gate.md`](artifacts/discovery-gate.md).

| Interface | Gate | Outcome |
| --- | --- | --- |
| `claude-cli` | **passed** | Implemented in this work item. |
| `claude-app` | **not passed** | No desktop-application session storage exists on the reference machine; no local record carries a desktop entrypoint. Not implemented, not claimed as supported. |
| `claude-vsc` | **not passed** | No native VS Code integration storage exists on the reference machine; no local record carries a VS Code entrypoint. Not implemented, not claimed as supported. |

Per the #3 gate rule, an interface must not be described as supported without
confirmed local evidence. `claude-app` and `claude-vsc` therefore remain
unsupported and are rejected as filter values with an explicit message, rather
than silently returning an empty report. Clarified and confirmed with the
requester: deliver `claude-cli` now, document the gate outcome for the other two.

## Clarification record

| # | Label | Question | Decision |
| --- | --- | --- | --- |
| 1 | `[REQ]` | `claude-app`/`claude-vsc` cannot pass the discovery gate on the available machine. Scope? | Ship `claude-cli`; document the gate result for the other two; leave them for a follow-up once real data exists. |
| 2 | `[REQ]` | `sdk-cli` sessions (2,414 of 2,462 local session files) are the requester's Slack bot driving Claude Code through the Agent SDK. Count them? | No. Report only `entrypoint: cli` — sessions a developer invoked. #3 lists "Slack or CI agents" as out of scope. Skipped sessions are counted and surfaced as a diagnostic, never silently dropped. |
| 3 | `[TECH]` | A resumed session replays the previous launch's records verbatim (identical `uuid` and `timestamp`). | Deduplicate by record `uuid`; the launch whose file first contains a record owns it. A resumed launch reports only its own new work. |
| 4 | `[TECH]` | How to detect a still-running launch? | `~/.claude/sessions/<pid>.json` plus a read-only PID liveness check, guarded against PID reuse by comparing `procStart` with the running process start time. |

## Scope

In scope:

- a `ClaudeCliReader` adapter in `modules/session-reader/src/infrastructure/`;
- `claude` provider and `claude-cli` interface in the provider-neutral model;
- `claude` / `claude-cli` agent filter values;
- composition-root wiring, help text, README, and an ADR for storage decisions;
- sanitized fixtures and colocated unit tests.

Out of scope:

- `claude-app`, `claude-vsc` (gate not passed), `codex-vsc`, `copilot-vsc`;
- new CLI options or columns;
- any change to time-calculation, grouping, filtering, or rendering semantics;
- Windows support, network access, telemetry.

## Behavior

### Discovery

- Session transcripts: `~/.claude/projects/<project-slug>/<sessionId>.jsonl`.
- Sub-agent transcripts: `~/.claude/projects/<project-slug>/<sessionId>/subagents/agent-<agentId>.jsonl`
  with a sibling `agent-<agentId>.meta.json` (`agentType`, `description`, `toolUseId`).
- Live launches: `~/.claude/sessions/<pid>.json`.
- The same layout applies on Linux and macOS; the base directory is
  `$HOME/.claude` on both, injected from the composition root.
- A missing `~/.claude` directory is not an error and produces no rows.

### Interface attribution

- `entrypoint: cli` → `claude-cli`. This includes interactive sessions and
  Claude Code background jobs (`sessionKind: bg`), which are developer-invoked
  work.
- Any other entrypoint (observed: `sdk-cli`) is an embedded Agent-SDK driver,
  out of scope per #3. Those sessions are skipped and reported as a single
  aggregated `warning` diagnostic carrying only a count — exit code stays `0`.
- A transcript recording no `entrypoint` at all cannot be confirmed as
  developer-invoked. It is skipped too, but reported under its own factual
  reason rather than being described as an Agent-SDK session.
- Sub-agents inherit `claude-cli` from their parent launch.

### Launch identity

- One transcript file (one `sessionId`) is one launch.
- Resuming produces a new `sessionId` file that replays earlier records with
  identical `uuid` and `timestamp`. Sessions are processed in ascending order of
  their first record — a resume replays that first record, so ties are broken by
  the last timestamp (the launch that stopped earlier is the original) and then
  by session id for a total order. A record `uuid` already claimed by an earlier
  launch is not counted again, and a launch left with no own records is dropped
  as empty.
- Invocation boundaries inside a single transcript are never guessed from
  inactivity gaps (#3 rule).

### Human prompts

A record is a human prompt when it is `type: "user"`, not a sidechain, not
`isMeta`, carries neither `toolUseResult` nor `sourceToolAssistantUUID` /
`sourceToolUseID`, and its `promptSource` is absent or one of `typed`, `queued`,
`suggestion_accepted`. `promptSource: "system"` records (task notifications,
command stdout) and `sdk` records are not human input.

### Agent time

- A span starts at a human prompt and ends at the last agent-activity record
  before the next human prompt, where agent activity is an `assistant` record or
  a `user` record carrying `toolUseResult`.
- A prompt with no following activity yields a zero-length span.
- A prompt submitted while work is still running ends the previous span at the
  last recorded activity, which is how cancellations and interruptions are
  counted (through their last recorded timestamp).
- A span that crosses a directory change is split at the boundary, so work
  recorded after the change is attributed to the new directory rather than to
  the one the prompt was submitted from. No span outlives the invocation that
  owns it.
- Sub-agent spans run from the sub-agent transcript's first to last record and
  are additive with the parent, including overlaps.

### Working directories

- Every record carries `cwd`. Consecutive records sharing a `cwd` form a
  segment; 28 of 48 local CLI sessions change `cwd` at least once (worktree
  switching), so segmentation is required, not theoretical.
- The first segment is the launch root (`isRoot: true`). Each later segment is
  emitted as a non-root invocation parented to the launch root, so the existing
  grouping service absorbs descendants into the root and gives unrelated
  directories their own row.
- Segments are not sub-agents: the model gains an optional `isSubagent` marker
  so the `subagents` column keeps counting only real sub-agents. Readers that
  omit the marker keep the previous `!isRoot` behavior.
- Metadata records that carry no `cwd` (for example `file-history-delta`)
  continue the current segment instead of opening an `unknown` one. A launch
  whose records never carry a `cwd` reports `unknown`.

### Active sessions

- A launch is active when some `~/.claude/sessions/<pid>.json` names its
  `sessionId`, that PID is alive, and the recorded `procStart` matches the
  running process start time (PID-reuse guard). Several entries may name the
  same session — a stale file left by a crashed process beside the live one — so
  all of them are kept and any live entry makes the launch active. On platforms
  without `/proc`, liveness alone is used and the guard is skipped.
- Only the last segment of an active launch has `endMs = null`.
- Active launches are not malformed. A completed launch always has a reliable
  end (its last record timestamp).

### Diagnostics

- Unreadable transcript file → `error` (exit `1`), reported per file.
- Malformed JSONL line → `error` (exit `1`), reported with file path and line
  number, never with content.
- Unreadable `~/.claude/sessions` entry → `warning`.
- Skipped non-CLI sessions → one aggregated `warning` with a count.
- No diagnostic ever carries prompts, responses, source code, or tool output.

## Acceptance criteria

1. `-a claude` and `-a claude-cli` select Claude rows; `-a claude-app` and
   `-a claude-vsc` fail with a clear usage error and exit `2`.
2. Claude rows carry launch, agent, path, human, agent-time, elapsed/duration,
   start, end, and sub-agent counts consistent with the existing contract.
3. Resumed launches do not double-count replayed records.
4. `cwd` changes produce descendant absorption and separate unrelated-root rows.
5. Sub-agent time is additive with parent time, including overlaps.
6. Active launches report `end`/`actual-end` as `null`/empty/`-` per format.
7. Non-CLI sessions are excluded and reported as a counted warning with exit `0`.
8. Unreadable/malformed records produce a partial report and exit `1`.
9. Codex and Copilot behavior and all pre-existing tests are unchanged.
10. Fixtures contain no real session content; tests are offline and do not read
    the developer's real history.
11. `--help`, README, and the ADR document the supported interface, the two
    gate-blocked interfaces, and the storage limitations.
