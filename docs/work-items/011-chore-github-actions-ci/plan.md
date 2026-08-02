# Implementation plan — 011 chore: GitHub Actions CI

## Design

Create one workflow (`CI`) with two jobs:

1. `Application checks`:
   - checkout;
   - setup Node.js latest LTS with npm cache;
   - `npm ci`;
   - `npm run typecheck`;
   - `npm test`;
   - `npm run build`.
2. `Repository policy checks`:
   - checkout;
   - run the six policy scripts from README in one fail-fast shell step.

Global workflow settings:

- `permissions: contents: read`;
- `concurrency` group keyed by workflow and PR number or branch ref;
- `cancel-in-progress: true`.

## Steps

1. Add `.github/workflows/ci.yml` with required triggers and jobs.
2. Update `README.md` with GitHub Actions CI trigger and check summary.
3. Create work-item artifacts (`spec.md`, `plan.md`, `test-plan.md`,
   `e2e-scenarios.md`, `artifacts/`).
4. Run local verification commands from issue/README.
