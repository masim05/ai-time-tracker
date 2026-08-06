# 014 — bug: report shows no session name for Codex sessions

Issue: [masim05/ai-time-tracker#13](https://github.com/masim05/ai-time-tracker/issues/13)

## Task type

`bug`

## Actual behavior

- Real `codex-cli` and `codex-app` rows render `name` as unset (`-`) even when
  Codex has persisted a user-assigned name or provider-generated title for the
  session.
- Other Codex metadata and timing values are still reported.
- The current reader queries only `threads.name` from `state_5.sqlite`; it does
  not inspect or normalize other provider-owned persisted naming metadata such
  as `threads.title`, nor has the complete live storage path been verified.

## Expected behavior

- A Codex CLI or App launch reports the applicable provider-persisted session
  label in table, JSON, and CSV output.
- Both of these provider-owned name classes are eligible:
  1. explicit user-assigned names persisted by Codex (for example a native
     rename action); and
  2. provider-generated titles persisted by Codex as session/thread metadata.
- Provider-owned timestamped naming history, when available, applies from each
  event timestamp until the next naming event and uses the temporal splitting
  contract from work item 012.
- When supported storage exposes only latest-value metadata, the chosen value
  applies launch-wide and produces the existing content-free approximate-history
  warning.
- A genuinely unnamed launch retains `-` (table), `null` (JSON), and an empty
  CSV field.

## Reproduction

```bash
npm run cli -- report -f 2026-07-01 -a codex
```

Expected: launches for which Codex persisted an explicit name or generated
title show that value rather than `-`.

## Root cause and provider discovery

Manager discovery against the supported Codex state schema confirmed that
`state_5.sqlite` table `threads` contains both `name` and `title`:

- `name` is the latest explicit user-assigned session name;
- `title` is the latest provider-generated persisted session title;
- neither field contains timestamped rename/title history.

The current `CodexReader` query selects `name` but not `title`, and
`resolveCodexNameEvents` returns no event when `name` is null. Consequently a
thread with a valid generated `title` and no explicit `name` is projected as
unnamed. The supported fix is a latest-value-only fallback: select both fields,
use trimmed non-empty `name` first and otherwise trimmed non-empty `title`, then
apply the selected value from launch start with the existing approximate-history
flag and warning. No conversation parsing is required or allowed.

## Clarification record

| # | Label | Question | Decision |
| --- | --- | --- | --- |
| 1 | `[REQ]` | Should the report include only explicit user-assigned Codex names, or also provider-generated persisted titles? | Include both explicit user-assigned names and provider-generated persisted titles. Do not infer names from ordinary prompt or response text. |

## Naming-source and precedence contract

Normalization follows these rules:

1. Read only provider-owned persisted naming metadata or naming events from the
   supported Codex stores. Never scan conversational text to derive a name.
2. The verified `threads.name` and `threads.title` fields are latest-value-only;
   apply the selected value from launch start and mark history approximate.
3. For competing values that apply at the same instant, an explicit
   user-assigned name takes precedence over a provider-generated title.
4. For latest-value-only metadata, prefer a non-empty explicit user-assigned
   name; otherwise use the non-empty provider-generated persisted title.
5. Normalize accepted values by trimming surrounding whitespace. An empty or
   whitespace-only value is absent and emits a content-free warning.
6. Name events belong to the launch root and are inherited by its sub-agent and
   working-directory activity without changing launch identity or time totals.

## Scope

In scope:

- discovery and documentation of supported Codex CLI/App naming storage;
- extraction of both explicit names and provider-generated persisted titles;
- deterministic precedence, fallback, and diagnostics;
- provider-neutral name-event normalization on the launch root;
- launch-wide latest-value attribution through the existing approximate-history
  contract; timestamped Codex rename reconstruction is not claimed;
- sanitized fixtures and regression coverage for Codex CLI and App;
- README or ADR updates if the discovered storage contract or limitation differs
  from current documentation.

Out of scope:

- Claude and Copilot name extraction;
- inferring names from prompts, responses, source code, or tool output;
- renaming or writing Codex sessions;
- changing the `name` column, default order, filters, sorting, time accounting,
  totals, launch identifiers, or format contracts;
- adding unsupported interfaces or network access.

## Constraints

- Keep all access offline and read-only.
- Keep provider-specific SQLite/file details inside the session-reader
  infrastructure adapter; domain and reporter code must remain provider-neutral.
- Diagnostics and recorded evidence must not expose real names, prompts,
  responses, source code, or tool output.
- Preserve valid report data when naming metadata is missing. Malformed or
  contradictory metadata follows the existing partial-failure/diagnostic
  contract without crashing the report.
- Follow bugfix boundaries: make a minimal focused fix, do not weaken existing
  assertions, and add a regression test that fails before the fix.

## Acceptance criteria

- A regression test fails before the fix and passes afterward.
- A named `codex-cli` fixture reports a persisted explicit user name.
- A named `codex-app` fixture reports a persisted explicit user name.
- A `codex-cli` fixture with no explicit name reports its persisted generated
  title.
- A `codex-app` fixture with no explicit name reports its persisted generated
  title.
- When both latest explicit name and generated title exist, the explicit name
  wins deterministically.
- Empty/whitespace explicit metadata falls back to a valid generated title and
  emits no content-bearing diagnostic.
- When neither eligible value exists, unset rendering remains `-`/`null`/empty
  for table/JSON/CSV.
- The verified latest metadata applies launch-wide, sets
  `hasApproximateNameHistory`, and emits the existing latest-only warning.
- Root naming metadata applies to parent and sub-agent activity without changing
  agent time, human time, duration, sub-agent count, launch identity, or path
  grouping.
- Period and path filters retain correct name attribution.
- Ordinary messages such as `call this session 'abc'` are never parsed as name
  metadata unless Codex itself persists the resulting value in a provider-owned
  name/title field or rename event.
- Malformed or contradictory naming metadata yields content-free diagnostics
  and preserves other valid report results under the existing exit-code policy.
- Existing non-Codex behavior, table/JSON/CSV equivalence, default columns,
  totals, and ordering remain unchanged.
- Table output limits `name` to 16 displayed characters, including a trailing
  ellipsis when truncation is required; JSON and CSV preserve the full label.
- Automated fixtures are sanitized and live evidence contains no real session
  name or conversation content.

## Architecture impact

- Primary change: `modules/session-reader/src/infrastructure/codexReader.ts` and
  its sanitized fixtures/tests.
- Provider-neutral domain types and reporter grouping should require no change;
  they already support `SessionNameEvent[]` and approximate history. Change them
  only if discovery identifies a verified contract gap, and document why.
- No new dependency, network access, data write, cross-module deep import, or
  architecture exception is authorized.

## Security, privacy, performance, and observability

- Security/privacy: database handles remain read-only; diagnostics identify
  only provider, interface, session id, file path, record type, timestamp, and
  reason. Real names may appear only in the requested report output, never in
  diagnostics or committed evidence.
- Performance: extend the existing bounded state query or a verified indexed
  naming query; avoid per-thread database queries and conversation scans.
- Observability: concise warning counts remain unchanged; `--verbose` adds only
  content-free source/fallback/malformed-metadata reasons.

## Definition of done

- Root cause and verified Codex storage shape are documented.
- The original reproduction no longer fails for eligible live Codex CLI/App
  sessions.
- All acceptance criteria have automated or explicitly identified manual
  evidence.
- Focused tests, full application checks, repository policy checks, and GitHub
  Actions pass.
- The pull request links Issue #13 and this work item and records sanitized live
  verification from the development server.
