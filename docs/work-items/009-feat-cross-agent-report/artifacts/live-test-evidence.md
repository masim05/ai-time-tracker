# Live Test Evidence — 009-feat-cross-agent-report

Read-only live validation of the cross-agent report CLI against the real local
GitHub Copilot CLI and Codex (CLI + App) session stores on the dev server.

> Security note: this file records only aggregate counts, commands, exit codes,
> and warnings. No session content (prompts, responses, source code, or tool
> output) is included, consistent with the work item's diagnostics constraint.

## Environment

- Node.js: v22.23.0
- npm: 10.9.8
- Access mode: read-only, offline (no network calls)
- Data sources present:
  - `~/.copilot/session-state/<uuid>/events.jsonl` + `workspace.yaml`
  - `~/.codex/state_5.sqlite`, `~/.codex/logs_2.sqlite`, `~/.codex/history.jsonl`

## Commands run and results

### Help and column catalog

```bash
npm run cli -- --help            # exit 0
npm run cli -- report --help     # exit 0, all 16 columns documented
npm run cli -- report -h         # exit 0
```

### Default report against real data

```bash
npm run cli -- report            # exit 0
```

- Total rows produced: **11**
- Rows by interface:
  - `copilot-cli`: 3
  - `codex-cli`: 3
  - `codex-app`: 5
- Active (in-progress) sessions with open-ended `end`: **1**
  (recency-guarded; stale `inuse.*.lock` files are not treated as active)
- Diagnostics emitted (non-verbose and `--verbose`): **0**
  (all discovered sources parsed successfully)

### Output formats

```bash
npm run cli -- report --output json   # exit 0, array of objects, integer-minute durations
npm run cli -- report --output csv    # exit 0, header + rows
```

### Filters

```bash
npm run cli -- report --agent copilot                 # exit 0, 3 rows
npm run cli -- report --agent codex                   # exit 0, 8 rows (codex-cli + codex-app)
npm run cli -- report --path ~/src/github.com/masim05/ai-time-tracker --output json
                                                       # exit 0, 2 rows
npm run cli -- report --from 2026-07-30 --to 2026-07-31 --output csv
                                                       # exit 0, 1 data row
```

### Column selection

```bash
npm run cli -- report --columns '+inactive,+truncated,+active' --output csv
# header: launch,agent,path,human,agent-time,start,duration,subagents,inactive,truncated,active
```

### Exit-code behavior

```bash
npm run cli -- report --output xml            # exit 2 (invalid output format)
npm run cli -- report --from 2026-08-01 --to 2026-07-01  # exit 2 (from after explicit to)
npm run cli -- report --columns 'launch,+inactive'       # exit 2 (mixing explicit and +/- forms)
npm run cli -- report --agent copilot --from 2099-01-01  # exit 0, "No matching sessions found."
```

## Warnings / anomalies observed

- A stale `inuse.*.lock` left by an interrupted Copilot CLI session initially
  made that session appear active, inflating `elapsed`. Mitigated by the
  `ACTIVE_RECENCY_MS` (10-minute) recency guard: a session is active only when
  a lock file is present **and** the newest event is recent. After the guard,
  only the genuinely in-progress session reports an open-ended `end`.
- Codex `~/.codex/goals_1.sqlite` `thread_goals` is empty on the dev server, so
  agent-time is derived by clustering per-thread log timestamps (see
  `docs/architecture/decisions/ADR-0002-session-storage-formats.md`).
