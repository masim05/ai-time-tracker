# Spec: feat — Cross-Agent Session Activity Report CLI

## Issue
https://github.com/masim05/ai-time-tracker/issues/3

## Task type
`feat`

## Summary
Implement `npm run cli -- report [options]` — a local, offline CLI command that discovers
Codex and Copilot session data from standard local storage locations, normalizes it into a
provider-neutral activity model, and emits a table, JSON, or CSV report of agent work time,
human-active time, inactive time, and elapsed time per launch × agent × working-directory row.

## Scope (Discovery Gate result)

| Interface | Status | Storage | Notes |
|---|---|---|---|
| `copilot-cli` | ✅ In scope | `~/.copilot/session-store.db` + `events.jsonl` | All metrics calculable |
| `codex-cli` | ✅ In scope (partial) | `~/.codex/state_5.sqlite` + `logs_2.sqlite` + `history.jsonl` | Human/inactive time via log/history cross-ref |
| `codex-app` | ✅ In scope (shared backend) | Same `~/.codex/` as Codex CLI | Detected via `codex_app_server` log target |
| `codex-vsc` | ⛔ Deferred | Not installed | Likely shares `~/.codex/` but not verified |
| `copilot-vsc` | ⛔ Deferred | Not installed | Separate runtime; not discoverable |

## Technology choices
- Language: TypeScript
- CLI framework: Commander.js
- Internal storage: SQLite via `better-sqlite3` (for any report-level caching)
- Runtime: Node.js

## Architecture (per `docs/architecture/`)

### Module layout
```
modules/
  session-reader/           # Discovery + provider-specific parsing
    src/
      domain/               # SessionEvent, TimeEntry, WorkInterval models
      application/          # ports: ISessionReader, ISessionDiscovery
      infrastructure/       # CopilotCliReader, CodexCliReader, CodexAppReader
      cli/                  # (none — no user-facing commands here)
    index.ts                # export { SessionReaderFactory }

  reporter/                 # Time calculation, grouping, column projection, formatting
    src/
      domain/               # ReportRow, ColumnSpec, TimeInterval models
      application/          # ReportBuilder, FilterService, ColumnProjector
      infrastructure/       # (none — pure calculation)
      cli/                  # ReportCommand (Commander handler), TableFormatter,
                            # JsonFormatter, CsvFormatter
    index.ts                # export { ReportCommand }

apps/
  cli/
    src/
      main.ts               # bin entry: registers ReportCommand, handles root --help
      container.ts          # DI wiring
```

### Zone rules enforced
- `domain/` + `application/` import nothing from CLI frameworks, SQLite, or file system
- `infrastructure/` owns all SQLite reads, file access, and OS detection
- `cli/` owns Commander argument parsing and output formatting

## Required CLI contract

### Invocation
```bash
npm run cli -- report [options]
npm run cli -- --help
npm run cli -- report --help
npm run cli -- report -h
```

### Options
| Option | Default |
|---|---|
| `-h, --help` | — |
| `-f, --from <datetime>` | beginning of history |
| `-t, --to <datetime>` | now (captured once) |
| `-o, --output <format>` | `table` |
| `-p, --path <directory>` | all paths (repeatable) |
| `-a, --agent <agent>` | all agents (repeatable) |
| `-c, --columns <selection>` | default columns |
| `-v, --verbose` | disabled |

### Supported agent values
Exact: `codex-cli`, `codex-app`, `copilot-cli`  
Family: `codex`, `copilot`

### Default columns (in order)
`launch`, `agent`, `path`, `human`, `agent-time`, `start`, `duration`, `subagents`

### Full column catalog
`launch`, `launch-id`, `agent`, `path`, `human`, `agent-time`, `elapsed`, `duration`,
`inactive`, `start`, `end`, `actual-start`, `actual-end`, `truncated`, `active`, `subagents`

### Exit codes
| Code | Meaning |
|---|---|
| 0 | Success (empty result allowed) |
| 1 | Partial failure (malformed/inaccessible records) |
| 2 | Invalid usage |

## Datetime parsing
Accept: ISO 8601, `YYYYMMDD`, `YYYYMMDD-HHmm`, `YYYYMMDD-HHmmss`, `YYYY-MM-DD`,
`YYYY-MM-DD-HHmm`, `YYYY-MM-DD-HHmmss`.
Missing time → `00:00:00`. Missing TZ → machine local. DST-ambiguous → reject unless
explicit offset supplied.

## Time calculation rules

### agent-time
- Starts at human prompt submission
- Ends when parent response + all sub-agents finish
- Parent and child spans are additive (including overlaps)
- Cancelled/failed work counted through cancellation/failure timestamp

### human-active time
- Initial interval (launch → first prompt): include if ≤ 30 min
- Subsequent intervals (last completion → next prompt): include if ≤ 20 min
- Attributed once to main agent's active root; never duplicated

### inactive time
- Human intervals excluded by the thresholds above

### elapsed
- launch → final completion (clipped to report period)
- Non-additive; repeats across path rows

## Row identity
Each row = `launch × agent × effective working-directory root`

Launch ID: deterministic hash of full launch identity (≤ 6 chars displayed; full ID in `launch-id`)

## Output formats
- **table**: vertically aligned, local timestamps `2026-08-01 17:01:46`, durations `0m / 3m / 10h3m`
- **json**: array of objects; durations = integer minutes; timestamps ISO 8601 with UTC offset
- **csv**: header + rows; same numeric/ISO conventions

## Security and privacy
- Read-only, local, offline only
- No network requests, no telemetry
- Diagnostics must never print prompts, responses, source code, or tool output

## Constraints
- Preserve second-level precision internally; round only for display
- Partial valid results on error; exit 1 not 0
- No Windows support required
