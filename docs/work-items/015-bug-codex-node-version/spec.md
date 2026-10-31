# 015 — bug: Codex sessions missing from report

Issue: [masim05/ai-time-tracker#15](https://github.com/masim05/ai-time-tracker/issues/15)

## Task type

`bug`

## Actual behavior

```bash
npm run cli -- report -f 2026-10-28 | grep codex
# no codex rows; "1 record(s) could not be read"
```

With `--verbose` the only Codex output is:

```text
[error] provider=codex file=~/.codex/state_5.sqlite reason=Codex state database is corrupt or unreadable
```

## Root cause

The database is healthy. `better-sqlite3` is a native addon; the local
`node_modules` was installed under Node 24 (`NODE_MODULE_VERSION 137`) while the
CLI was run under Node 22 (`NODE_MODULE_VERSION 127`, selected by nvm). Loading
the addon fails with `ERR_DLOPEN_FAILED`, which `CodexReader` catches and
reports as a corrupt/unreadable state database, dropping all Codex rows.

Running the same report under Node 24 reads `state_5.sqlite` and reports the
expected `codex-app` rows. The repository has no pinned Node version, so nothing
keeps the install-time and run-time Node versions aligned; CI uses `lts/*`.

## Expected behavior

- The repository pins one supported Node major in `.nvmrc` (`24`, the active
  LTS and the version `node_modules` builds against locally).
- `nvm use` in the repository selects that version, so `npm install` and
  `npm run cli` use the same ABI and Codex rows are reported.

## Clarification record

- [REQ] Fix scope → only enforce Node 24 in `.nvmrc` (maintainer direction:
  "you need just enforce node 24 in the nvmrc"); no CI or README changes.
- [TECH] Exit code on native-module load failure → unchanged (exit 1, partial
  failure).
- [REQ] Codex time accuracy observed under Node 24 (human `0m`, multi-day
  duration) → out of scope; follow-up issue.

## Out of scope

- Changing `CodexReader` diagnostics or error classification.
- Replacing `better-sqlite3` or adding `engines` enforcement.
- CI workflow and README changes.
- Codex time-accuracy observations.
