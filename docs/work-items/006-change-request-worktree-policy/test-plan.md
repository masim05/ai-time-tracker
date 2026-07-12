# Test Plan: AI Flow Worktree Policy

## Manual Policy Checks

- Verify `docs/engineering/ai-development-flow.md` says the flow creates or reuses the task worktree before writing artifacts.
- Verify `README.md` distinguishes `ai-development-flow` automatic worktree setup from request-driven worktree use outside the flow.
- Verify `docs/architecture/project-structure.md` and `docs/engineering/definition-of-done/README.md` no longer claim that every task always runs from an automatically created worktree.
- Verify `.gitlab/merge_request_templates/default.md` reflects the same conditional wording.
- Verify `docs/ai/prompts/developer.md` no longer duplicates worktree logic owned by the source-of-truth flow.

## Automated Checks

- Run `scripts/check-ai-flow-config.sh`.
- Run `scripts/check-architecture.sh`.
- Run `scripts/check-specs.sh`.
- Run `scripts/check-dod.sh`.
- Run `scripts/check-pr.sh`.
- Run `git diff --check`.

## E2E Coverage

This change updates repository workflow policy and documentation only. No executable E2E test is added, but the flow narrative must still include a happy-path scenario in `e2e-scenarios.md` because the affected behavior is user-visible at the orchestration level.