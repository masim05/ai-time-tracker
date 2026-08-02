# 011 — chore: run automated tests and validation in GitHub Actions CI

Issue: [masim05/ai-time-tracker#7](https://github.com/masim05/ai-time-tracker/issues/7)

## Task type

`chore`

## Problem

The repository has no GitHub Actions workflow, so pull requests and pushes to
`main` do not run type checking, automated tests, production build, or
repository policy checks in GitHub-hosted CI.

## Clarification record

| # | Label | Question | Decision |
| --- | --- | --- | --- |
| 1 | `[TECH]` | Which Node.js version should GitHub Actions use? | Use the latest LTS release line (`lts/*`). |

## Scope

In scope:

- add a GitHub Actions workflow under `.github/workflows/`;
- trigger on pull requests to `main`, pushes to `main`, and manual dispatch;
- run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`;
- run repository policy scripts listed in the README;
- set minimal workflow permissions and cancel superseded runs;
- update README documentation for contributor CI expectations.

Out of scope:

- product behavior changes;
- deployment/release automation;
- GitLab CI redesign/removal;
- coverage publishing or external integrations.

## Requirements

1. Workflow file exists and is valid GitHub Actions YAML.
2. Triggers:
   - `pull_request` targeting `main`;
   - `push` to `main`;
   - `workflow_dispatch`.
3. Workflow installs dependencies with `npm ci`.
4. Workflow runs:
   - `npm run typecheck`;
   - `npm test`;
   - `npm run build`;
   - `scripts/check-ai-flow-config.sh`;
   - `tests/integration/check-ai-flow-config.sh`;
   - `scripts/check-architecture.sh`;
   - `scripts/check-specs.sh`;
   - `scripts/check-dod.sh`;
   - `scripts/check-pr.sh`.
5. Workflow fails if any required command fails.
6. Workflow uses least-privilege token permissions suitable for checkout and CI.
7. Workflow cancels obsolete in-progress runs for the same PR/branch.
8. Workflow job names are clear and stable for future branch protection setup.
9. README documents CI trigger behavior and checks.

## Acceptance criteria

- `.github/workflows/ci.yml` is present and implements all required triggers and
  commands.
- Application checks and policy checks are distinguishable in Actions UI.
- Workflow uses read-only permissions at workflow level.
- Concurrency cancellation is enabled for superseded runs.
- README reflects GitHub Actions CI behavior for contributors.
