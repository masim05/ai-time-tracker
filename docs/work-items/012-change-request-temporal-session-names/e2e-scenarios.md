# End-to-end scenarios — 012 temporal session names

## E1 — Default report includes `name`

```bash
npm run cli -- report
```

Expected: default table includes `name` between `path` and `human`.

## E2 — Output contract for unset names

```bash
npm run cli -- report -o table
npm run cli -- report -o json
npm run cli -- report -o csv
```

Expected: unset name renders as `-` (table), `null` (json), empty CSV field.

## E3 — Temporal splits at rename boundaries

Run against fixture-backed tests and any live sessions with persisted rename events.

Expected: same launch id appears on multiple chronological rows when name changes; rename-back produces distinct non-adjacent rows.

## E4 — Latest-only fallback warning

Run with `--verbose` on providers that expose latest-only explicit name metadata.

Expected: content-free warning explains historical rename boundaries were unavailable.
