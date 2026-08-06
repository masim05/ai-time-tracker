# End-to-end scenarios — 014 Codex session name

All scenarios are offline and read-only. Evidence must never reproduce a real
session name, prompt, response, source-code fragment, or tool output.

## E1 — Codex CLI persisted label is reported

```bash
npm run cli -- report -f 2026-07-01 -a codex-cli
```

Expected: each eligible CLI launch with a provider-persisted explicit name or
generated title has a non-unset `name`; genuinely unnamed launches remain `-`.

## E2 — Codex App persisted label is reported

```bash
npm run cli -- report -f 2026-07-01 -a codex-app
```

Expected: the same contract holds for App launches. Interface classification,
timing, path, duration, and sub-agent values are unchanged.

## E3 — Naming precedence and history

Use sanitized fixture-backed E2E input, or a safely created disposable local
launch if native Codex behavior can be exercised without exposing content.

Expected:

- explicit user-assigned metadata wins over a simultaneously applicable
  generated title;
- the selected latest value applies launch-wide and `-v` reports an
  approximate-history warning because verified Codex storage has no naming
  history timestamps.

## E4 — Sub-agents inherit the root label

Report a launch with child activity.

Expected: root and child-attributed rows use the root’s applicable name segment;
agent-time, human time, duration, sub-agent count, path grouping, and launch id
match the baseline.

## E5 — Output equivalence

```bash
npm run cli -- report -f 2026-07-01 -a codex -o table
npm run cli -- report -f 2026-07-01 -a codex -o json
npm run cli -- report -f 2026-07-01 -a codex -o csv
```

Expected: eligible rows represent the same persisted label in every format;
unset remains `-`, `null`, and empty respectively. Evidence records only counts
and equality results, not values.

## E6 — Content-free diagnostics

```bash
npm run cli -- report -f 2026-07-01 -a codex -v
```

Expected: fallback or malformed-metadata diagnostics show only safe metadata
and reasons. They contain no name value or conversational content.

## E7 — No regression for other agents

```bash
npm run cli -- report -f 2026-07-01 -a copilot -a claude
```

Expected: Copilot and Claude results and diagnostics are unchanged.
