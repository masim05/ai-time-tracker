# Test Plan: feat — Cross-Agent Session Activity Report CLI

## Automated tests (fixture-based, offline)

### 1. DateTimeParser unit tests
- [ ] All 7 accepted formats parse correctly
- [ ] ISO 8601 with UTC offset parses correctly
- [ ] Missing time defaults to `00:00:00`
- [ ] Missing TZ defaults to machine local
- [ ] DST-ambiguous local time without offset → error
- [ ] `--from` later than `--to` → exit 2

### 2. TimeCalculator unit tests
- [ ] agent-time: single prompt → response
- [ ] agent-time: sub-agent spans counted additively with parent
- [ ] agent-time: overlapping concurrent prompts counted additively
- [ ] agent-time: cancelled work counts through cancellation timestamp
- [ ] agent-time: failed work counts through failure timestamp
- [ ] human-active: initial interval ≤ 30m → included
- [ ] human-active: initial interval > 30m → excluded (goes to inactive)
- [ ] human-active: initial interval = 30m exactly → included
- [ ] human-active: subsequent interval ≤ 20m → included
- [ ] human-active: subsequent interval > 20m → excluded
- [ ] human-active: subsequent interval = 20m exactly → included
- [ ] human-active: never starts while agent is active
- [ ] human-active: attributed once (not duplicated across path rows)
- [ ] elapsed: clipped to report period boundaries
- [ ] elapsed: repeats across launch's path rows (non-additive)

### 3. GroupingService unit tests
- [ ] Single session → one row per cwd-root
- [ ] Directory changes within session → separate rows
- [ ] Descendant paths absorbed into parent root
- [ ] Sub-agent in unrelated directory → separate row
- [ ] Unknown cwd → `unknown` row; excluded when `--path` filter active
- [ ] Launch hash: ≤6 chars, deterministic
- [ ] Launch hash: full ID collision detection → full IDs used for colliding rows

### 4. FilterService unit tests
- [ ] `--from` / `--to` inclusive boundary clipping
- [ ] `--path` recursive matching (existing and deleted paths)
- [ ] `--path` expands `~`, resolves relative paths, normalizes separators
- [ ] `--path` does not resolve symlinks
- [ ] `--agent codex` selects codex-cli + codex-app
- [ ] `--agent copilot` selects copilot-cli
- [ ] Repeated `--agent` forms union without duplicates
- [ ] Unknown agent value → exit 2

### 5. ColumnProjector unit tests
- [ ] Default columns in correct order
- [ ] Replacement mode: `--columns 'start,inactive'`
- [ ] Modification add: `--columns '+inactive'`
- [ ] Modification remove+add: `--columns '-start,+inactive,+actual-start'`
- [ ] Mixed unsigned+signed → exit 2
- [ ] Unknown column → exit 2
- [ ] Duplicate replacement column → exit 2
- [ ] Repeated `--columns` → exit 2
- [ ] Empty final selection → exit 2
- [ ] Adding existing column → no-op
- [ ] Removing absent column → no-op

### 6. CopilotCliReader unit tests (sanitized fixtures)
- [ ] Parses `session.start`, `user.message`, `assistant.turn_start/end`, `subagent.started/completed`, `session.shutdown`
- [ ] Sub-agent `parentId` chain reconstructed correctly
- [ ] Cancelled session: `abort` event counted
- [ ] Failed tool: `tool.execution_complete` with `success: false` counted
- [ ] `host_type` → `copilot-cli` interface assignment
- [ ] Missing/corrupt `events.jsonl` → partial result + exit 1

### 7. CodexReader unit tests (sanitized fixtures)
- [ ] Thread → activity record with `created_at_ms`, `updated_at_ms`
- [ ] `thread_spawn_edges` → sub-agent DAG reconstructed
- [ ] `thread_goals.time_used_seconds` → agent-time for thread
- [ ] `history.jsonl` prompts cross-referenced for human-active time
- [ ] `codex_app_server` log target → `codex-app` interface
- [ ] Otherwise → `codex-cli` interface
- [ ] Missing `state_5.sqlite` → not-found warning + exit 0 (no data)
- [ ] Corrupt SQLite → exit 1

### 8. Output format tests
- [ ] Table: aligned columns, `~` home substitution, duration format (`0m`, `3m`, `10h3m`, `2d10h3m`)
- [ ] Table: local timestamp format `2026-08-01 17:01`
- [ ] JSON: array of objects, integer-minute durations, ISO 8601 with UTC offset
- [ ] JSON: empty result → `[]`
- [ ] JSON: active session `actual-end` → `null`
- [ ] CSV: header + rows, same numeric/ISO conventions
- [ ] CSV: empty result → header row only
- [ ] CSV: active session `actual-end` → empty field
- [ ] All formats: same rows, same column projection

### 9. CLI / exit code tests
- [ ] `--help` exits 0 with complete help text
- [ ] `report --help` / `report -h` exits 0 with full report contract
- [ ] Invalid option → exit 2, usage message
- [ ] No matching data → exit 0, empty output + warning
- [ ] Malformed record → partial output + exit 1
- [ ] Inaccessible location → exit 1
- [ ] `--verbose` includes record-level metadata on stderr
- [ ] Diagnostics never include prompts, responses, or source code

## Live testing (development server)
- [ ] Run `npm run cli -- report` against real Copilot + Codex data
- [ ] Verify table, JSON, CSV output with `--output` flag
- [ ] Verify `--from` / `--to` filtering with real timestamps
- [ ] Verify `--agent copilot-cli` and `--agent codex` filters
- [ ] Verify partial failure path (if unsupported/malformed records found)
- [ ] Record sanitized evidence in `artifacts/` (counts, commands, warnings — no session content)

## Security checklist
- [ ] Report output contains no prompts, responses, or source code
- [ ] Diagnostics contain no session content
- [ ] All file access is read-only
- [ ] No network calls made during any test
