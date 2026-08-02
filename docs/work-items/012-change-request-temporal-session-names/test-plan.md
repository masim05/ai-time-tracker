# Test plan — 012 change-request temporal session names

## Automated tests

- `modules/session-reader/src/infrastructure/copilotCliReader.test.ts`
  - parses explicit workspace name metadata and fallback warning.
- `modules/session-reader/src/infrastructure/codexReader.test.ts`
  - parses explicit thread-name metadata and fallback warning.
- `modules/session-reader/src/infrastructure/claudeCliReader.test.ts`
  - parses timestamped explicit name events.
- `modules/reporter/src/application/groupingService.test.ts`
  - rename-boundary splitting, rename-back chronology, duplicate-name dedupe.
- `modules/reporter/src/application/columnProjector.test.ts`
  - default columns include `name`.
- `modules/reporter/src/cli/formatters.test.ts`
  - `name` output in table/json/csv with unset contract.
- `modules/reporter/src/cli/reportCommand.test.ts`
  - help/default behavior remains coherent.

## Repository checks

Run:

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
