# Test plan — 014 bug: Codex session name

## Traceability

| Requirement | Evidence |
| --- | --- |
| Explicit persisted names for CLI/App | Codex reader fixture tests + E1/E2 |
| Generated persisted titles for CLI/App | Required failing regression tests + E1/E2 |
| Explicit-over-generated precedence | Codex reader unit test |
| Latest-only fallback | Codex reader tests + E3 |
| Root/sub-agent inheritance and unchanged timing | Reader/grouping regression tests + E4 |
| Equivalent table/JSON/CSV rendering | Existing formatter tests + E5 |
| No prompt-text inference | Negative fixture test |
| Content-free diagnostics and read-only access | Diagnostic assertions + E6 |
| Non-Codex compatibility | Full suite + E7 |

## Required regression test

`modules/session-reader/src/infrastructure/codexReader.test.ts` must include at
least one sanitized provider-generated persisted title case that yields no name
on `main` and yields the expected root `sessionNameEvents` after the fix. Cover
`codex-cli` and `codex-app` with verified storage shapes.

## Automated tests

### Codex reader

- extracts a non-empty explicit name for CLI and App roots;
- extracts a non-empty generated persisted title for CLI and App roots when no
  explicit name exists;
- chooses explicit name when both eligible latest values exist;
- trims surrounding whitespace;
- falls back to a valid generated title when explicit metadata is empty or
  whitespace and emits a content-free warning for the invalid field;
- produces no event for an unnamed launch and preserves existing unset behavior;
- sets `hasApproximateNameHistory` and warns when applying a latest-only value
  launch-wide;
- emits exactly one selected name event at launch start because the verified
  fields are latest-only;
- attaches name events only to the launch root; sub-agents remain unnamed at the
  reader level and inherit through grouping;
- ignores ordinary prompt/history text that resembles a rename request;
- handles missing optional naming schema compatibly where supported, and emits
  existing partial-error diagnostics for malformed/contradictory metadata;
- never puts a session name or conversation content in diagnostic reasons.

### Reporter regression

Use or extend existing tests at the lowest meaningful layer to confirm:

- name boundaries split rows without altering launch identity;
- parent/sub-agent agent-time remains additive and unchanged;
- period and path clipping preserve applicable names;
- adjacent identical values do not create redundant rows;
- table/JSON/CSV still render unset as `-`/`null`/empty and expose the same name;
- default column order, sorting, totals, duration, human time, and sub-agent
  count are unchanged.

### Privacy fixture review

- fixtures contain synthetic ids, paths, timestamps, names, and titles only;
- no real prompt, response, source code, tool output, or developer session name
  is committed.

## Manual live verification

On the development server, perform read-only verification against available
Codex CLI and Codex App data:

1. capture a baseline count of eligible persisted explicit names and generated
   titles without recording their values;
2. run the issue reproduction before and after the fix;
3. verify at least one eligible launch for each available interface;
4. compare table, JSON, and CSV using counts/boolean matches rather than copying
   real names;
5. run `--verbose` and confirm diagnostics contain no name or conversation data.

Store only commands, interface/count summaries, warning/error outcomes, and
pass/fail conclusions under `artifacts/`.

## Repository checks

```bash
npm run typecheck
npm test
npm run build
bash scripts/check-ai-flow-config.sh
bash tests/integration/check-ai-flow-config.sh
bash scripts/check-architecture.sh
bash scripts/check-specs.sh
bash scripts/check-dod.sh
bash scripts/check-pr.sh
```

All focused checks must pass before the full suite. GitHub Actions must be green
on the pushed commit.
