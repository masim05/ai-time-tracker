# Implementation plan — 010 feat: Claude Code support

## Architecture impact

Additive, adapter-only. The provider-neutral model, time calculation, grouping,
filtering, projection, and rendering keep their current semantics.

| Layer | Change |
| --- | --- |
| `modules/session-reader/src/domain/models.ts` | Add `'claude'` to `ProviderId`, `'claude-cli'` to `InterfaceId`, and an optional `isSubagent` marker on `NormalizedInvocation`. |
| `modules/session-reader/src/infrastructure/claudeCliReader.ts` | New adapter implementing `ISessionReader`; owns all file access and the PID-liveness probe. |
| `modules/session-reader/index.ts` | Export the new reader and its options. |
| `modules/reporter/src/application/groupingService.ts` | `subagents` counts `isSubagent ?? !isRoot`, so directory segments are not counted as sub-agents. Existing readers keep their behavior. |
| `modules/reporter/src/application/filterService.ts` | `claude` family and `claude-cli` exact value; `claude-app` / `claude-vsc` rejected with a message naming the gate outcome. |
| `modules/reporter/src/domain/column.ts`, `src/cli/reportCommand.ts` | Help text lists the supported Claude interface. |
| `apps/cli/src/container.ts` | Wire `ClaudeCliReader` with `~/.claude`. |
| `docs/architecture/decisions/ADR-0003-claude-session-storage.md` | Storage-format and identity decisions. |
| `README.md` | Supported interfaces and Claude storage limitations. |

No zone rule changes: `domain/` and `application/` stay pure; `node:fs`,
`node:path`, and `node:process` access is confined to `infrastructure/`.

## Reader algorithm

1. **Collect.** Walk `~/.claude/projects/*/`; take each `*.jsonl` directly inside
   a project directory as a candidate launch. A missing base directory yields an
   empty result and no diagnostic.
2. **Parse.** Read each file line by line. A malformed line is skipped and
   reported as an `error` diagnostic with file path and line number.
3. **Select.** Keep sessions whose first record with an `entrypoint` says `cli`.
   Count the rest and emit one aggregated `warning`.
4. **Deduplicate.** Sort kept sessions by first record timestamp ascending; a
   record whose `uuid` was already claimed by an earlier session is dropped.
   Sessions left without own records are dropped as empty.
5. **Segment.** Walk own records in timestamp order tracking the current `cwd`.
   Assign prompts and agent-activity timestamps to the segment in effect.
6. **Spans.** For each human prompt, span = prompt timestamp → last agent
   activity before the next human prompt (zero-length when none).
7. **Sub-agents.** For each `‹sessionId›/subagents/agent-*.jsonl`, emit a
   non-root invocation with `isSubagent: true`, span first → last record,
   `cwd` from its records, parented to the launch root.
8. **Active.** Index `~/.claude/sessions/*.json` by `sessionId`; a launch is
   active when its PID is alive and `procStart` matches `/proc/<pid>/stat`
   field 22 where readable. Only the last segment gets `endMs = null`.

## Testability seams

`ClaudeCliReaderOptions` injects `baseDir`, `nowMs`, and `isPidAlive`, so unit
tests run entirely against sanitized fixtures with a deterministic clock and a
stubbed liveness probe. No test reads the developer's real history.

## Steps

1. Model additions and grouping sub-agent count.
2. Reader implementation.
3. Sanitized fixtures covering: single-cwd launch, cwd change (descendant and
   unrelated), sub-agents, resume replay, non-CLI session, malformed line,
   active session.
4. Colocated unit tests for the reader; filter-service tests for the new agent
   values.
5. Wiring, help text, README, ADR.
6. Local validation: `npm test`, `npm run build`, `npm run typecheck`, and the
   five repository policy scripts.
7. Live read-only run against real local Claude data; sanitized evidence in
   `artifacts/live-test-evidence.md`.
