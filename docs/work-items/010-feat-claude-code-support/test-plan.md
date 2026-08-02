# Test plan — 010 feat: Claude Code support

Framework: Vitest, colocated `*.test.ts` (see `docs/engineering/testing-policy.md`).
All tests are offline, use sanitized fixtures under
`modules/session-reader/src/infrastructure/__fixtures__/claude/`, and inject a
stubbed PID-liveness probe. No test reads the developer's real `~/.claude`.

## Fixture set

| Fixture | Purpose |
| --- | --- |
| `projects/-work-alpha/s1….jsonl` | Single-directory launch: two prompts, assistant activity, a tool result, and a system-injected notification. |
| `projects/-work-alpha/s2….jsonl` | Resume of `s1`: replays its records verbatim, then adds own work. |
| `projects/-work-alpha/s3….jsonl` | Directory changes: launch root, a descendant worktree, an unrelated root, plus a metadata record with no `cwd`. |
| `projects/-work-alpha/s3…/subagents/agent-{aaa,bbb}.jsonl` + `.meta.json` | Two sub-agents: one overlapping the parent, one in an unrelated directory. |
| `projects/-work-alpha/s8….jsonl` | Pure replay of `s1` with no own work (fully replayed launch). |
| `projects/-work-beta/s4….jsonl` | `entrypoint: sdk-cli` session that must be skipped. |
| `projects/-work-beta/s5….jsonl` | Malformed JSONL line plus valid records. |
| `projects/-work-beta/s6….jsonl` | Single-segment launch registered live. |
| `projects/-work-beta/s7….jsonl` | Response that changes directory mid-answer, with no prompt at the boundary. |
| `projects/-work-beta/s9….jsonl` | Transcript with no `entrypoint` recorded. |
| `sessions/{4242,5151,9150}.json` | Live registry: `s6` live, `s3` live, and a stale entry naming `s3` that is read *after* the live one. |

Fixtures contain only structural metadata and timestamps: no prompt text, no
responses, no source code, no tool output.

## Reader unit tests (`claudeCliReader.test.ts`, 33 cases)

1. Missing base directory → no invocations, no diagnostics.
2. `entrypoint: cli` session → one root invocation with provider `claude`,
   interface `claude-cli`, correct `cwd`, prompts, and start/end.
3. Human-prompt classification, table-driven over the exported `isHumanPrompt`
   (12 cases): `typed`, `queued`, `suggestion_accepted`, and absent
   `promptSource` are prompts; `system`, `sdk`, `isMeta`, sidechain, tool
   result, `sourceToolAssistantUUID`, `sourceToolUseID`, and assistant records
   are not.
4. Agent-activity classification (`isAgentActivity`): assistant records and
   tool results only.
5. Agent spans: prompt → last activity before the next prompt.
6. Span splitting at a directory change inside one response, with the assertion
   that no span outlives its invocation's end.
7. Directory segmentation: descendant and unrelated roots, `isSubagent: false`,
   parenting to the launch root, per-segment span totals.
8. Metadata records without `cwd` continue the current segment.
9. Sub-agents: one invocation per `agent-*.jsonl`, `isSubagent: true`, parented
   to the launch root, additive spans.
10. Resume dedupe: replayed records counted once; the resumed launch keeps only
    its own new work.
11. A fully replayed launch is dropped as empty.
12. `sdk-cli` session skipped with exactly one aggregated `warning` naming the
    count, and no `error`.
13. A transcript with no `entrypoint` skipped under its own distinct reason.
14. Malformed line → `error` diagnostic naming file and line; valid records
    from the same file still returned.
15. Active detection: live registered PID → open end; dead PID → closed at the
    last record.
16. Multi-segment active launch: only the last segment has an open end.
17. A stale registry entry read after the live one does not mask it.
18. Diagnostics carry only allow-listed metadata keys (no content).
19. `procStartFromStat`: simple process name, a name containing spaces and
    parentheses, and malformed input.

## Reporter tests

20. `filterService.claudeAgents.test.ts` (10 cases): `claude` family, exact
    `claude-cli`, union with Codex/Copilot without duplicates, `claude-app` and
    `claude-vsc` rejected with an explanation, unknown value message, and
    inherited `Object.prototype` keys (`constructor`, `toString`, `__proto__`,
    `valueOf`) treated as unknown values.
21. `groupingService.segments.test.ts` (3 cases): directory segments excluded
    from the `subagents` count, unchanged behavior for readers that omit the
    marker, and an unrelated segment getting its own row.

## Regression guard

22. The full pre-existing suite passes unmodified — 107 tests, no existing test
    file edited.

## End-to-end

23. Exit code 1 is demonstrated end-to-end against a synthetic home directory
    containing a malformed transcript: partial rows on stdout, a content-free
    error diagnostic on stderr, exit `1`. Recorded in
    `artifacts/live-test-evidence.md` (E6).

## Traceability

| Acceptance criterion (spec) | Tests |
| --- | --- |
| 1 filters | 20 |
| 2 row contract | 2, 5, 7, 9, 21 |
| 3 resume | 10, 11 |
| 4 directories | 6, 7, 8 |
| 5 additive sub-agents | 9, 21 |
| 6 active | 15, 16, 17, 19 |
| 7 non-CLI excluded | 12, 13 |
| 8 partial + exit 1 | 14, 23 |
| 9 no regressions | 22 |
| 10 sanitized offline fixtures | fixture set, 1, 18 |
| 11 documentation | e2e scenarios E1, E6 |
