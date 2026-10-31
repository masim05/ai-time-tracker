# End-to-end scenarios — 015 Codex missing (Node version)

Offline and read-only. Evidence must not include session names, prompts, or
paths beyond the `~/.codex` file names.

## E1 — nvm selects the pinned version

```bash
nvm use && node -v
```

Expected: `v24.x`.

## E2 — Codex rows appear under the pinned version

```bash
nvm use && npm rebuild better-sqlite3 && npm run cli -- report -f 2026-10-28 -a codex --verbose
```

Expected: at least one `codex-*` row; no `Codex state database is corrupt or
unreadable` diagnostic.

## E3 — Root cause reproduces under a mismatched Node

With `node_modules` built for Node 24, run the report under Node 22.

Expected: no Codex rows and the `corrupt or unreadable` diagnostic, confirming
the ABI mismatch is the cause (documents why the pin is needed).
