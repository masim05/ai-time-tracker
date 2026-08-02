# Test plan — 011 chore: GitHub Actions CI

## Local validation commands

Run in repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
scripts/check-ai-flow-config.sh
tests/integration/check-ai-flow-config.sh
scripts/check-architecture.sh
scripts/check-specs.sh
scripts/check-dod.sh
scripts/check-pr.sh
```

Expected: all commands succeed.

## Workflow validation

1. Confirm `.github/workflows/ci.yml` parses as valid workflow YAML.
2. Confirm triggers include:
   - `pull_request` to `main`;
   - `push` to `main`;
   - `workflow_dispatch`.
3. Confirm workflow-level read-only permissions.
4. Confirm concurrency cancellation is enabled.
5. Confirm actions UI shows separate job names:
   - `Application checks`;
   - `Repository policy checks`.

## Traceability

| Requirement | Verification |
| --- | --- |
| Triggers and manual run | Workflow `on` block in `ci.yml` |
| Dependency install + app checks | `Application checks` job steps |
| Policy checks | `Repository policy checks` job step |
| Fail on errors | Default fail-fast + `set -euo pipefail` |
| Minimal permissions | `permissions: contents: read` |
| Cancel superseded runs | `concurrency` block |
| Contributor documentation | `README.md` CI section |
