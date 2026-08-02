# Test plan — 010 feat: Claude Code support

Framework: Vitest, colocated `*.test.ts` (see `docs/engineering/testing-policy.md`).
All tests are offline, use sanitized fixtures under
`modules/session-reader/src/infrastructure/__fixtures__/claude/`, and inject a
fixed clock and a stubbed PID-liveness probe. No test reads `~/.claude`.

## Fixture set

| Fixture | Purpose |
| --- | --- |
| `projects/-work-alpha/<s1>.jsonl` | Single-cwd launch: two prompts, assistant activity, tool results. |
| `projects/-work-alpha/<s2>.jsonl` | Resume of `s1`: replays `s1` records verbatim plus own new work. |
| `projects/-work-alpha/<s3>.jsonl` | Directory change: launch root, a descendant directory, and an unrelated directory. |
| `projects/-work-alpha/<s3>/subagents/agent-*.jsonl` + `.meta.json` | Two sub-agents, one overlapping the parent, one in an unrelated directory. |
| `projects/-work-beta/<s4>.jsonl` | `entrypoint: sdk-cli` session that must be skipped. |
| `projects/-work-beta/<s5>.jsonl` | Malformed JSONL line plus valid records. |
| `projects/-work-beta/<s6>.jsonl` | Active launch, paired with a `sessions/<pid>.json` entry. |
| `sessions/<pid>.json` | Live-launch registry entry for `s6`. |

Fixtures contain only structural metadata and timestamps: no prompt text, no
responses, no source code, no tool output.

## Reader unit tests (`claudeCliReader.test.ts`)

1. Missing base directory → no invocations, no diagnostics.
2. `entrypoint: cli` session → one root invocation with provider `claude`,
   interface `claude-cli`, correct `cwd`, prompts, and start/end.
3. Human-prompt classification: `promptSource: system`, `isMeta`, sidechain, and
   tool-result user records are not prompts; `typed`, `queued`, and
   `promptSource`-absent records are.
4. Agent spans: prompt → last activity before the next prompt; trailing prompt
   with no activity yields a zero-length span.
5. Interruption: a prompt arriving during activity closes the previous span at
   the last recorded activity.
6. `cwd` segmentation: descendant directory stays in the launch root's segment
   chain, unrelated directory produces its own invocation; segments carry
   `isSubagent: false`.
7. Sub-agents: one invocation per `agent-*.jsonl` with `isSubagent: true`,
   parented to the launch root, spans first → last record.
8. Resume dedupe: replayed records counted once; the resumed launch reports only
   its own new work; a fully replayed launch is dropped as empty.
9. `sdk-cli` session skipped; exactly one aggregated `warning` diagnostic with a
   count; no `error`.
10. Malformed line → `error` diagnostic naming file and line, valid records from
    the same file still returned.
11. Active detection: PID alive and `procStart` matching → `endMs === null` on
    the last segment only; PID dead → completed with the last record timestamp;
    `procStart` mismatch (PID reuse) → completed.
12. No diagnostic field contains message content.

## Reporter tests

13. `resolveAgentFilters(['claude'])` → `{claude-cli}`; `['claude-cli']` → same;
    unioned with `codex`/`copilot` values without duplicates.
14. `claude-app` and `claude-vsc` rejected with a `UsageError` explaining the
    gate outcome (exit `2` at the command layer).
15. `subagents` column counts sub-agents only, not directory segments, and stays
    unchanged for readers that do not set `isSubagent`.

## Regression guard

16. Full pre-existing suite passes unmodified (no existing test file is edited).

## Traceability

| Acceptance criterion (spec) | Tests |
| --- | --- |
| 1 filters | 13, 14 |
| 2 row contract | 2, 6, 7, 15 |
| 3 resume | 8 |
| 4 directories | 6 |
| 5 additive sub-agents | 7 |
| 6 active | 11 |
| 7 non-CLI excluded | 9 |
| 8 partial + exit 1 | 10 |
| 9 no regressions | 16 |
| 10 sanitized offline fixtures | fixture set, 1 |
| 11 documentation | e2e scenarios E1, E6 |
