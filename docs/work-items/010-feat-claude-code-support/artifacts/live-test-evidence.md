# Live test evidence — 010 feat: Claude Code support

Environment: Linux development machine, Claude Code 2.1.220, real local history
(646 project directories, 2,678 transcripts). All runs read-only and offline.
Only commands, counts, warnings, and exit codes are recorded below — no prompt,
response, source-code, or tool-output content.

Automated suite before live testing: **129 tests passed** (15 files, 105
pre-existing unchanged + 24 new), `npm run typecheck` clean, `npm run build`
clean, all six repository policy checks passed.

## E1 — Help

```bash
npm run cli -- report --help
```

Exit `0`. The agent option lists `claude-cli` and the `claude` family; the
detailed help states that `claude-app` and `claude-vsc` are unsupported and why.

## E2 — Claude rows in the report

```bash
npm run cli -- report -a claude -c 'launch,agent,path,human,agent-time,elapsed,active,subagents' -o json
```

Exit `0`. Result:

| Measure | Value |
| --- | --- |
| Rows | 51 |
| Distinct launches | 49 |
| Rows with `unknown` path | 0 |
| Active launches | 8 |
| Sum of `agent-time` | 8,464 min |
| Sum of `human` | 292 min |
| Sub-agents counted | 186 |

The 8 active launches match exactly the 8 entries in `~/.claude/sessions/` whose
processes were alive. 51 rows for 49 launches: most directory changes are
worktrees below the launch root and are absorbed into it, while two launches
moved to unrelated roots and correctly produced a second path row.

### Independent cross-check of one launch

One real launch was recomputed with a standalone script applying the documented
rules (prompt classification, span = prompt → last activity before next prompt):

| | Independent script | Reported |
| --- | --- | --- |
| prompts | 3 | — |
| agent-time | 3.2 min | 3 min (rounded) |
| distinct directories | 2 (one metadata record carries no `cwd`) | 1 path row, no `unknown` row |
| sub-agents | 0 | 0 |

The first run of this check surfaced a defect: metadata records that carry no
`cwd` (for example `file-history-delta`) opened a spurious `unknown` directory
segment, inflating the report from 51 to 85 rows. Fixed so such records continue
the current segment, covered by a regression test, and re-verified above.

## E3 — Agent filters

```bash
npm run cli -- report -a claude -o json        # 51 rows, all agent=claude-cli
npm run cli -- report -a claude -a codex -o json
npm run cli -- report -a claude-app
```

The union run returned `claude-cli` 51, `codex-app` 1, `codex-cli` 1 with no
duplicated rows. `-a claude-app` printed
`Agent 'claude-app' is not supported: the Claude desktop application stores no
local session data that could be discovered.` and exited **2**.

## E4 — Path filtering

```bash
npm run cli -- report -a claude -p ~/src -o json     # 49 rows, exit 0
npm run cli -- report -a claude -p /nonexistent/tree # empty report, exit 0
```

The deleted/nonexistent tree printed `No matching sessions found.` plus the
warning summary on stderr, `[]` on stdout, and exited `0`.

## E5 — Period clipping and formats

```bash
npm run cli -- report -a claude -f 20260715 -t 20260731-2359 -o csv
npm run cli -- report -a claude -f 20260720 -c 'launch,truncated,active,actual-start,actual-end,end' -o json
npm run cli -- report -a claude -f 20260801
```

CSV emitted the header plus 47 rows with integer-minute durations and ISO-8601
timestamps including the local offset. The clipped period reported `truncated`
for the one launch spanning the boundary and `start` clipped to
`2026-07-15T00:00:00+00:00`. 9 rows of active launches reported `end: null` in
JSON. Table output aligned columns, used `~` for the home directory, and
formatted durations as `1d1h33m`. All exits `0`.

## E6 — Diagnostics and exit codes

```bash
npm run cli -- report -a claude              # stderr: 1 warning(s); re-run with --verbose for details.
npm run cli -- report -a claude --verbose    # stderr: [warning] provider=claude reason=2414 session(s) skipped: driven by an embedded Agent SDK (entrypoint other than "cli"), which is out of scope for this report
npm run cli -- report -a claude -c bogus     # exit 2
```

No `error` diagnostics were produced against the real history, so exit stayed
`0`. Every skipped session is accounted for by the count; nothing is dropped
silently. No diagnostic contained session content.

## E7 — Read-only guarantee

- No transcript other than this session's own two files changed mtime during the
  runs (`find ~/.claude/projects -name '*.jsonl' -newermt '-12 minutes'` minus
  this session's own ids returned nothing).
- The reader uses only `fs.readFileSync` and `fs.readdirSync`; no write, unlink,
  or rename call exists in the adapter.
- No `net`, `http`, `https`, `dns`, or `tls` import exists anywhere in `modules/`
  or `apps/`, so no report run can open a network connection.

## Interfaces not covered

`claude-app` and `claude-vsc` could not be live-tested because no such session
data exists on this machine — that is the discovery-gate result, not a gap in
testing. `codex-vsc` and `copilot-vsc` remain out of scope for this work item.
