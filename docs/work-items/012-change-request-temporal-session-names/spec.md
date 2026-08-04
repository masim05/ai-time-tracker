# 012 — change-request: temporal session names in report rows

Issue: [masim05/ai-time-tracker#9](https://github.com/masim05/ai-time-tracker/issues/9)

## Task type

`change-request`

## Current behavior

- Report rows do not include a session name column.
- Report defaults are `launch, agent, path, human, agent-time, start, duration, subagents`.
- Readers do not emit normalized explicit name metadata.

## Requested behavior

- Add `name` to the report column catalog and default columns after `path`.
- Extract explicit provider-persisted naming metadata only.
- Split report rows by effective temporal name boundaries.
- Render unset names as `-` (table), `null` (JSON), empty field (CSV).

## Clarification record

| # | Label | Question | Decision |
| --- | --- | --- | --- |
| 1 | `[REQ]` | Should latest-name fallback apply globally when rename history is missing? | Only when provider-specific discovery confirms fallback validity. |

## Provider discovery summary

- **Codex (`~/.codex/state_5.sqlite`)**: `threads` table contains `name` and `title`; no rename-history table exists. Fallback confirmed only for latest explicit name metadata (`name`) with warning.
- **Copilot CLI (`~/.copilot/session-state/*/workspace.yaml`)**: workspace metadata contains `name` and `user_named`; event stream has no session-rename history event. Fallback confirmed only when `user_named: true`, with warning.
- **Claude CLI**: normalized from transcript metadata events (`sessionName` + user/rename/launch source) in sanitized fixtures; full timestamped history supported by events when present.

## Scope

In scope:

- session-name event model in normalized invocation domain;
- reader extraction for Codex, Copilot CLI, and Claude CLI;
- temporal row splitting and ordering updates in grouping/report builder;
- `name` column and default-set updates, formatter behavior, help text, README;
- tests and sanitized fixtures.

Out of scope:

- inferring names from prompt/response text;
- mutating provider data;
- adding a name filter.
