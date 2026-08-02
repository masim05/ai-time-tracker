# Plan: feat — Cross-Agent Session Activity Report CLI

## Branch
`feat/009-feat-cross-agent-report`

## Worktree
`tmp/wts/009-feat-cross-agent-report/`

## Implementation order

### Phase 0: Project setup
1. Initialize TypeScript workspace: `package.json`, `tsconfig.json`, `tsconfig.build.json`
2. Install dependencies: `typescript`, `commander`, `better-sqlite3`, `@types/*`
3. Update `README.md` testing-policy section and `docs/engineering/testing-policy.md`
4. Document application architecture in `docs/architecture/` (update `overview.md` / create any needed ADR)
5. Add `npm run cli` and `npm test` scripts

### Phase 1: Domain + application layer (`modules/session-reader`)
6. Define domain models: `SessionEvent`, `LaunchRecord`, `WorkInterval`, `ActivityRecord`
7. Define application ports: `ISessionDiscovery`, `ISessionReader`
8. Unit tests for domain models (pure logic, no I/O)

### Phase 2: Infrastructure — Copilot CLI reader
9. `CopilotCliDiscovery`: locate `~/.copilot/session-state/*/events.jsonl`
10. `CopilotCliReader`: parse `events.jsonl` → `ActivityRecord[]`
    - Extract `session.start`, `user.message`, `assistant.turn_start/end`, `tool.execution_start/complete`, `subagent.started/completed`, `session.shutdown`
    - Map `host_type` from `workspace.yaml` to `copilot-cli` / `copilot-app`
11. Sanitized fixture tests (no real session content)

### Phase 3: Infrastructure — Codex CLI + App reader
12. `CodexDiscovery`: locate `~/.codex/state_5.sqlite`
13. `CodexReader`: read `threads`, `thread_spawn_edges`, `thread_goals`, `logs_2.sqlite`, `history.jsonl`
    - Distinguish `codex-cli` vs `codex-app` via `logs.target` prefix (`codex_app_server::*`)
    - Build per-thread activity timeline from goals + log events + history prompts
14. Sanitized fixture tests

### Phase 4: Domain + application layer (`modules/reporter`)
15. Domain models: `ReportRow`, `ColumnSpec`, `LaunchSummary`
16. `TimeCalculator`: agent-time, human-active, inactive, elapsed (per spec rules)
    - Additive parent/child span counting
    - Initial (≤30m) and subsequent (≤20m) human thresholds
    - Inclusive period clipping
17. `GroupingService`: group `ActivityRecord[]` → `launch × agent × cwd-root` rows
18. `FilterService`: `--from/--to` date clipping, `--path` recursive matching, `--agent` family/exact filter
19. `ColumnProjector`: default and custom `--columns` logic (add/remove/replace modes)
20. `LaunchHasher`: deterministic ≤6-char hash with collision detection
21. Unit tests for every calculation rule

### Phase 5: CLI layer (`modules/reporter/src/cli/`)
22. `DateTimeParser`: all 7 accepted formats + ISO 8601; DST ambiguity rejection
23. `ReportCommand`: Commander command definition with full `--help` text
24. `TableFormatter`, `JsonFormatter`, `CsvFormatter`
25. Exit code logic: 0 / 1 / 2
26. `--verbose` diagnostics to stderr

### Phase 6: App wiring (`apps/cli/`)
27. `main.ts`: bin script; register `ReportCommand`; root `--help`
28. `container.ts`: DI wiring
29. `package.json` bin field, `npm run cli` script

### Phase 7: Testing + documentation
30. Integration tests with sanitized fixtures (Linux discovery paths)
31. Live end-to-end tests against real Copilot + Codex data on dev server (read-only)
32. Record sanitized live-test evidence in `artifacts/`
33. Update `README.md` with usage examples and supported interfaces
34. Add ADR if material storage-format decisions were made

## Commit strategy
- Phase 0–1: `feat: project setup and session-reader domain`
- Phase 2: `feat: add copilot-cli session reader`
- Phase 3: `feat: add codex-cli and codex-app session reader`
- Phase 4–5: `feat: add reporter domain, time calculations, and CLI command`
- Phase 6–7: `feat: wire CLI app, add tests and documentation`

## PR
Create PR referencing issue #3 and work item `009-feat-cross-agent-report`.
