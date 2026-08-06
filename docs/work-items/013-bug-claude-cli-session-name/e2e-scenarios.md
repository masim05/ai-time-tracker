# End-to-end scenarios — 013 `claude-cli` session name

## E1 — Named Claude launch reports its name (issue reproduction)

```bash
npm run cli -- report -f 20260803
```

Expected: the `claude-cli` row for a launch renamed with `/rename` shows that
name in the `name` column instead of `-`.

## E2 — Output contract across formats

```bash
npm run cli -- report -f 20260803 -o table
npm run cli -- report -f 20260803 -o json
npm run cli -- report -f 20260803 -o csv
```

Expected: the same name appears in all three formats; launches with no
persisted name still render `-` (table), `null` (JSON), empty field (CSV).

## E3 — Rename during a launch splits rows

Rename a live Claude CLI session mid-session, then report over that period.

Expected: the launch appears on consecutive chronological rows, the earlier row
carrying the previous name (or unset) and the later row the new name, with
launch identity preserved.

Coverage note: only the `unset → name` half of this scenario is observable in
the local corpus, because every `/rename` there is a launch's first rename. The
`name → name` transition is covered at unit level instead — fixture `s1`
(`alpha` at 09:10 → `beta` at 09:12 → `gamma delta` at 09:12:30) and
`groupingService.test.ts > splits rows at temporal name boundaries and keeps
launch identity`.

## E3b — Resumed launch keeps the name

Resume a named Claude CLI session (`claude --resume`) and report over the
period covering both launches.

Expected: both the original launch and the resumed one report the name. The
original reports it from its own rename history; the resumed one reports it
launch-wide from its untimestamped `custom-title` record, with a latest-only
warning visible under `-v`.

## E4 — No regression for other agents

```bash
npm run cli -- report -f 20260803 -a copilot -a codex
```

Expected: Copilot and Codex names and their latest-only fallback warnings are
unchanged.

## E5 — Content-free diagnostics

```bash
npm run cli -- report -f 20260803 -v
```

Expected: verbose diagnostics mention provider, session id, file path, event
type, timestamp, and reason only; no session name argument text, prompt, or
response content is emitted beyond the reported `name` column values.
