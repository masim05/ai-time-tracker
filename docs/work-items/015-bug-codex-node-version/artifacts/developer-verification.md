# Developer verification — 2026-10-31

All live checks were offline and read-only against `~/.codex`. Report rows are
replaced with counts; no session names, prompts, or paths were captured.

## E1 — nvm selects the pinned version

```text
$ nvm use && node -v
Found '.nvmrc' with version <24>
Now using node v24.22.0
v24.22.0
```

## E2 — Codex rows appear under the pinned version

```text
$ nvm use && npm rebuild better-sqlite3 && npm run cli -- report -f 2026-10-28 -a codex --verbose
exit code: 0
codex rows: 3 (codex-app)
"Codex state database is corrupt or unreadable" diagnostics: 0
codex diagnostics: 32 warnings (29 "session naming history unavailable",
3 "generated session title metadata was empty or whitespace"); 0 errors
```

## E3 — Root cause reproduces under a mismatched Node

`node_modules` built under Node 24; CLI run with Node 22 first on `PATH`.

```text
$ node -v
v22.23.3
$ npm run cli -- report -f 2026-10-28 -a codex --verbose
exit code: 1
codex rows: 0
[error] provider=codex reason=Codex state database is corrupt or unreadable  (1 occurrence)
```

This confirms the native-addon ABI mismatch is the cause and that keeping the
install-time and run-time Node versions aligned via `.nvmrc` restores Codex rows.
