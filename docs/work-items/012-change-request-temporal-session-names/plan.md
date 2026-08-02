# Implementation plan — 012 change-request temporal session names

1. Extend normalized reader/report contract:
   - add `SessionNameEvent`;
   - add root-level `sessionNameEvents` and `hasApproximateNameHistory`.
2. Implement provider extraction:
   - Copilot: parse `workspace.yaml` (`name`, `user_named`) as latest-only explicit name fallback.
   - Codex: read `threads.name` as latest-only explicit name fallback.
   - Claude: parse timestamped explicit session-name metadata events from transcript records.
3. Update grouping:
   - derive per-launch temporal name segments;
   - split rows at rename boundaries;
   - split agent/human/inactive contributions by segment period;
   - preserve launch identity.
4. Update report schema and UX:
   - add `name` column;
   - include `name` in default columns after `path`;
   - update formatters, help text, and README.
5. Add/adjust tests and fixtures for:
   - column/default behavior;
   - temporal splitting semantics;
   - reader extraction and fallback diagnostics.
