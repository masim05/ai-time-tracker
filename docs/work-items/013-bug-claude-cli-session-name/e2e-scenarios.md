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
