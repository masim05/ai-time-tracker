# End-to-end scenarios — 010 feat: Claude Code support

Executed read-only against real local Claude Code data on the development
machine. Evidence (commands, counts, warnings, exit codes — never session
content) is recorded in [`artifacts/live-test-evidence.md`](artifacts/live-test-evidence.md).

## E1 — Help documents the supported Claude interface

```bash
npm run cli -- report --help
```

Expected: the agent option and the `agent` column list `claude-cli`; the text
states that `claude-app` and `claude-vsc` are not supported; exit `0`.

## E2 — Claude rows appear in the default report

```bash
npm run cli -- report
```

Expected: table output containing `claude-cli` rows alongside `copilot-cli`,
`codex-cli`, and `codex-app`; deterministic ordering by path → start → launch →
agent; exit `0`.

## E3 — Agent filters

```bash
npm run cli -- report -a claude
npm run cli -- report -a claude-cli -o json
npm run cli -- report -a claude -a codex -o json
npm run cli -- report -a claude-app
```

Expected: the first three return only the selected interfaces, the union
contains no duplicate rows, and all rows in the JSON runs have
`"agent": "claude-cli"` (or a Codex interface in the union run). The last
command fails with a usage error naming the gate outcome and exits `2`.

## E4 — Path filtering and directory segmentation

```bash
npm run cli -- report -a claude -p ~/src -o json
npm run cli -- report -a claude -p /nonexistent/tree
```

Expected: the first restricts rows to that tree, including launches whose work
moved into a descendant directory; a launch that moved to an unrelated
directory shows a separate path row. The second prints an empty report with a
concise warning and exits `0`.

## E5 — Period clipping and formats

```bash
npm run cli -- report -a claude -f 20260715 -t 20260731-2359 -o csv
npm run cli -- report -a claude -c '+inactive,+actual-start,+actual-end,+truncated,+active' -o json
```

Expected: CSV header plus rows with integer-minute durations and ISO-8601
timestamps including the local offset; clipped launches report `truncated`;
active launches report an empty CSV field / `null` JSON value for the open end;
exit `0`.

## E6 — Diagnostics, skipped embedders, and exit codes

```bash
npm run cli -- report -a claude
npm run cli -- report -a claude --verbose
npm run cli -- report -a claude -c bogus
```

Expected: the first summarises warnings without detail and suggests `--verbose`;
the second lists content-free per-record metadata (provider, interface, session
id, file path, event type, timestamp, reason) and reports the count of skipped
non-CLI sessions; neither prints prompts, responses, source code, or tool
output. The third exits `2`.

## E7 — Read-only guarantee

Compare `~/.claude` modification times and file count before and after a full
report run.

Expected: the reporter creates, modifies, and deletes nothing; no network
connection is opened.
