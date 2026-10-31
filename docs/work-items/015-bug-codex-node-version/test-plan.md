# Test plan — 015 bug: Codex missing (Node version)

## Traceability

| Requirement | Evidence |
| --- | --- |
| `.nvmrc` pins Node 24 | file content + E1 |
| Codex rows reported under pinned Node | E2 |
| Root cause reproduced under mismatched Node | E3 |
| CI uses `.nvmrc` | workflow diff + green `Application checks` run log showing Node 24 |
| No regression | `npm run typecheck`, `npm test`, `npm run build`, policy scripts |

## Automated checks

- `npm run typecheck`, `npm test`, `npm run build` under Node from `.nvmrc`.
- `scripts/check-ai-flow-config.sh`, `tests/integration/check-ai-flow-config.sh`,
  `scripts/check-architecture.sh`, `scripts/check-specs.sh`,
  `scripts/check-dod.sh`, `scripts/check-pr.sh`.

No unit test is added: the change is configuration/documentation only and does
not touch application code.

## Manual / E2E

See `e2e-scenarios.md`. Evidence goes to `artifacts/developer-verification.md`.
