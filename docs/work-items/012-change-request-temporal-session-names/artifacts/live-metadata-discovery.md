# Live metadata discovery (sanitized)

Date: 2026-08-02

## Codex

- Source inspected: `~/.codex/state_5.sqlite` schema.
- Observed: `threads` includes `name` and `title`; no table storing rename-event history.
- Conclusion: only latest explicit name fallback is available when `name` is populated.

## Copilot CLI

- Source inspected: `~/.copilot/session-state/*/workspace.yaml` and `events.jsonl` metadata keys.
- Observed: workspace metadata includes `name` and `user_named`; no session-rename history event found in event types scanned.
- Conclusion: only latest explicit user name fallback is available when `user_named: true`.

## Claude CLI

- Live `~/.claude/projects` unavailable on this machine.
- Temporal extraction validated using sanitized repository fixtures with explicit session-name metadata events.
