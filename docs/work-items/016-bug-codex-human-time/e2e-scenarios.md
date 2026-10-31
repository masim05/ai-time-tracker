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
