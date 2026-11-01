# End-to-end scenarios — 016 Codex human time

All scenarios are offline and read-only. Evidence must not reproduce real
prompts, responses, or tool output; session names may be redacted.

## E1 — Codex human time is no longer always 0

```bash
npm run cli -- report -f 2026-10-28 -a codex
```

Expected: a Codex launch with idle time between user turns (for example the
2026-10-31 two-turn thread) reports `human` > `0m`, and its `agent-time`
reflects turn durations rather than the whole thread.

## E2 — Unchanged columns

Compare the same command on `main` and on the branch.

Expected: `agent`, `path`, `name`, `start`, `duration`, and `subagents` are
unchanged for every Codex row; only `human` and `agent-time` may differ.

## E3 — Other providers unchanged

```bash
npm run cli -- report -f 2026-10-28 -a claude-cli
npm run cli -- report -f 2026-10-28 -a copilot-cli
```

Expected: identical output on `main` and on the branch.

## E4 — Imported threads are skipped (R8)

```bash
npm run cli -- report -f 2026-10-16 -a codex -t 2026-10-31
npm run cli -- report -f 2026-10-16 -a codex -t 2026-10-31 --verbose
```

Expected: threads listed in `external_agent_session_imports.json` without
post-import Codex turns produce no rows; one warning
`N Codex thread(s) skipped: imported …` names the imports file; native Codex
rows are identical to `b0a97c8` (JSON); `claude-cli` and `copilot-cli` JSON
output for the same window is identical to `b0a97c8`.
