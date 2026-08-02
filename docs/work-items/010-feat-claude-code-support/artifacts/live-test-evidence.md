# Live test evidence — 010 feat: Claude Code support

Environment snapshot: Linux development machine, Claude Code 2.1.220,
**2026-08-02T01:58Z**. Real local history at that moment: 647 project
directories, 2,697 transcripts, 73,229 `entrypoint` values (`cli` 30,368,
`sdk-cli` 42,861). All runs read-only and offline. Only commands, counts,
warnings, and exit codes are recorded — no prompt, response, source-code, or
tool-output content.

**The machine keeps producing and pruning sessions, so every figure below is a
snapshot.** Re-running later will drift; the invariants that must hold are the
properties (all entrypoints `cli` or `sdk-cli`, active launches equal to live
registry entries with a live process, sub-agent count equal to the number of
`agent-*.jsonl` files under reported launches), not the absolute numbers.

Automated suite at this commit: **153 tests passed** in 15 files —
**107 pre-existing, none modified**, plus **46 new** (`claudeCliReader.test.ts`
33, `filterService.claudeAgents.test.ts` 10,
`groupingService.segments.test.ts` 3). `npm run typecheck`, `npm run build`, and
all six repository policy checks pass.

## E1 — Help

```bash
npm run cli -- report --help
```

Exit `0`. The agent option lists `claude-cli` and the `claude` family; the
detailed help states that `claude-app` and `claude-vsc` are unsupported and why.

## E2 — Claude rows in the report

```bash
npm run cli -- report -a claude -c 'launch,launch-id,agent,path,human,agent-time,elapsed,active,subagents' -o json
```

Exit `0`. Result:

| Measure | Value |
| --- | --- |
| Rows | 51 |
| Distinct launches | 49 |
| Rows with `unknown` path | 0 |
| Active launches | 7 |
| Sum of `agent-time` | 8,531 min |
| Sum of `human` | 292 min |
| Sub-agents (per launch, not per row) | 92 |

Cross-checks at this snapshot:

- Active launches equal the live `~/.claude/sessions/` entries whose process was
  alive at the time of the run.
- Sub-agents: 92 reported, and exactly 92 `agent-*.jsonl` files exist under the
  49 reported launches (counted independently).
- 51 rows for 49 launches: most directory changes are worktrees below the launch
  root and are absorbed into it; two launches moved to unrelated roots and
  produced a second path row.

### Independent cross-check of one launch

One real launch was recomputed with a standalone script applying the documented
rules (prompt classification, span = prompt → last agent activity before the
next prompt): 3 prompts, 3.2 min agent-time, versus 3 min reported (rounded to
whole minutes).

That check surfaced a real defect: metadata records carrying no `cwd` (for
example `file-history-delta`) opened a spurious `unknown` directory segment,
inflating the report from 51 to 85 rows. Fixed, regression-tested, re-measured
above.

## E3 — Agent filters

```bash
npm run cli -- report -a claude -o json          # 51 rows, all agent=claude-cli
npm run cli -- report -a claude -a codex -o json # union, no duplicate rows
npm run cli -- report -a claude-app              # exit 2
```

The union run returned `claude-cli` 51 plus the Codex rows with no duplicates.
`-a claude-app` printed `Agent 'claude-app' is not supported: the Claude desktop
application stores no local session data that could be discovered.` and exited
**2**; `-a claude-vsc` behaves the same.

## E4 — Path filtering

```bash
npm run cli -- report -a claude -p ~/src -o json     # 49 rows, exit 0
npm run cli -- report -a claude -p /nonexistent/tree # empty report, exit 0
```

The nonexistent tree printed `No matching sessions found.` plus the warning
summary on stderr, `[]` on stdout, and exited `0`.

## E5 — Period clipping and formats

```bash
npm run cli -- report -a claude -f 20260715 -t 20260731-2359 -o csv
npm run cli -- report -a claude -f 20260720 -c 'launch,truncated,active,actual-start,actual-end,end' -o json
npm run cli -- report -a claude -f 20260801
```

CSV emitted a header plus 47 rows with integer-minute durations and ISO-8601
timestamps including the local offset. The clipped period reported `truncated`
for the launch spanning the boundary and `start` clipped to the period start.
Active launches reported `end: null` in JSON and an empty field in CSV. Table
output aligned columns, used `~` for the home directory, and formatted durations
as `1d1h33m`. All exits `0`.

## E6 — Diagnostics and exit codes

```bash
npm run cli -- report -a claude              # stderr: 1 warning(s); re-run with --verbose for details.
npm run cli -- report -a claude --verbose    # stderr: [warning] provider=claude reason=<n> session(s) skipped: driven by an embedded Agent SDK …
npm run cli -- report -a claude -c bogus     # exit 2
```

Against the real history no `error` diagnostic occurs, so the exit code stays
`0` and every skipped session is accounted for by the aggregated count.

**Exit code 1 demonstrated end-to-end** against a synthetic home directory
containing one transcript with a malformed line:

```bash
HOME=<tmp> npm run cli -- report -a claude
# stdout: the valid launch row (5m agent-time)
# stderr: 1 record(s) could not be read; re-run with --verbose for details.
# exit:   1
HOME=<tmp> npm run cli -- report -a claude --verbose
# stderr: [error] provider=claude interface=claude-cli session=demo file=<path> event=jsonl-line reason=malformed JSON at line 2
# exit:   1
```

Partial results are printed alongside the diagnostic, and the diagnostic carries
no record content.

## E7 — Read-only guarantee

- No transcript other than the running session's own changed mtime during the
  runs.
- The adapter uses only `fs.readFileSync` and `fs.readdirSync`; it contains no
  write, unlink, or rename call.
- No `net`, `http`, `https`, `dns`, or `tls` import exists anywhere in
  `modules/` or `apps/`, so no report run can open a network connection.

## Interfaces not covered

`claude-app` and `claude-vsc` could not be live-tested because no such session
data exists on this machine — that is the discovery-gate result, not a testing
gap. `codex-vsc` and `copilot-vsc` remain out of scope for this work item.
