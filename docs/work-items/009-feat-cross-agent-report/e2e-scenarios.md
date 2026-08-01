# E2E Scenarios: feat — Cross-Agent Session Activity Report CLI

---

## Scenario 1: Basic table report — Copilot CLI sessions

**Actor:** Developer on a machine with Copilot CLI history

**Command:**
```bash
npm run cli -- report
```

**Expected outcome:**
- Discovers `~/.copilot/session-state/*/events.jsonl`
- Outputs aligned table with default columns: `launch agent path human agent-time elapsed start end`
- Durations formatted as `0m`, `3m`, `10h3m`, etc.
- Exit code 0

---

## Scenario 2: Filtered report — Codex sessions from the last 7 days

**Command:**
```bash
npm run cli -- report --agent codex --from 2026-07-25
```

**Expected outcome:**
- Only `codex-cli` and `codex-app` rows appear
- Rows outside the date range are excluded
- Missing `codex-app` rows (if app not used) produce no warning (mixed provider)
- Exit code 0

---

## Scenario 3: JSON output with path filter

**Command:**
```bash
npm run cli -- report --output json --path ~/projects/myapp
```

**Expected outcome:**
- Only rows whose activity paths are under `~/projects/myapp` (expanded) appear
- Output is a JSON array; empty periods produce `[]`
- `actual-end` is ISO 8601 with UTC offset; active sessions have `null`
- Exit code 0

---

## Scenario 4: CSV output for all Copilot interfaces

**Command:**
```bash
npm run cli -- report --output csv --agent copilot
```

**Expected outcome:**
- CSV header + rows for `copilot-cli` rows only (scope of this implementation)
- Duration values are integer minutes
- Timestamps include UTC offset
- Empty result produces header row only
- Exit code 0

---

## Scenario 5: Custom column selection

**Command:**
```bash
npm run cli -- report --columns '-start,+inactive,+actual-start'
```

**Expected outcome:**
- Default columns with `start` removed, `inactive` and `actual-start` appended
- Columns appear in the documented final order
- Exit code 0

---

## Scenario 6: Period clipping — session spans report boundary

**Setup:** A session started before `--from` and ended after `--to`

**Command:**
```bash
npm run cli -- report --from 2026-07-28 --to 2026-07-29 --columns '+truncated'
```

**Expected outcome:**
- `start` and `end` are clipped to the report period
- `actual-start` and `actual-end` show the unclipped values
- `truncated` column shows `true`
- `elapsed` is the clipped duration

---

## Scenario 7: Sub-agent additive time

**Setup:** A session with a parent prompt running for 10 min and a sub-agent running concurrently for 10 min

**Command:**
```bash
npm run cli -- report --from <session-date> --to <session-date+1>
```

**Expected outcome:**
- `agent-time` = 20m (additive, not deduplicated)
- Sub-agent row may appear separately if it ran in a different directory

---

## Scenario 8: Human threshold boundary

**Setup:** A session with an initial idle gap of exactly 30 minutes, and a subsequent gap of exactly 20 minutes

**Expected outcome:**
- Both gaps appear as `human` time (inclusive boundary)
- A gap of 30m 1s initial → `inactive`; a gap of 20m 1s subsequent → `inactive`

---

## Scenario 9: Partial failure — malformed record

**Setup:** One `events.jsonl` is corrupt/unreadable; other sessions are valid

**Command:**
```bash
npm run cli -- report --verbose
```

**Expected outcome:**
- Valid sessions appear in output
- Stderr shows record-level diagnostic: provider, session ID, file path, reason
- No prompts, responses, or source code in diagnostics
- Exit code 1

---

## Scenario 10: No matching data

**Command:**
```bash
npm run cli -- report --agent copilot --from 2099-01-01
```

**Expected outcome:**
- Empty table (or `[]` / header-only CSV)
- Concise warning on stderr: "No matching sessions found"
- Exit code 0

---

## Scenario 11: Invalid usage

**Command:**
```bash
npm run cli -- report --output xml
npm run cli -- report --columns 'launch,+inactive'
npm run cli -- report --from 2026-08-01 --to 2026-07-01
```

**Expected outcome:**
- Each invalid command prints a clear usage error
- Exit code 2

---

## Scenario 12: Help text completeness

**Commands:**
```bash
npm run cli -- --help
npm run cli -- report --help
npm run cli -- report -h
```

**Expected outcome:**
- Root help lists available commands
- Report help documents: every option, default, accepted format, all 14 columns, calculation rules, threshold values, diagnostic behavior, and examples
- Exit code 0 for all three
