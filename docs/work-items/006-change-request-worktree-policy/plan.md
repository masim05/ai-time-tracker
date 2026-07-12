# Plan: AI Flow Worktree Policy

**Goal:** Clarify that `ai-development-flow` must create or reuse a task worktree before artifacts or implementation, while leaving non-flow worktree usage request-driven.

## Task 1: Define The Policy In The Source Of Truth

- Modify `docs/engineering/ai-development-flow.md`.
- Add the worktree creation/reuse rule immediately after clarification and before artifact creation.
- State that all artifacts and implementation for the flow run from the same worktree.

## Task 2: Align Repository Documentation

- Modify `README.md`.
- Modify `docs/architecture/project-structure.md`.
- Modify `docs/engineering/definition-of-done/README.md`.
- Modify `.gitlab/merge_request_templates/default.md`.
- Adjust wording so only `ai-development-flow` guarantees automatic worktree setup.

## Task 3: Remove Wrapper-Level Duplication

- Modify `docs/ai/prompts/developer.md`.
- Keep role wrapper scope intact while removing duplicated worktree logic owned by the source-of-truth flow document.

## Task 4: Verify Repository Consistency

- Run `scripts/check-ai-flow-config.sh`.
- Run `scripts/check-architecture.sh`.
- Run `scripts/check-specs.sh`.
- Run `scripts/check-dod.sh`.
- Run `scripts/check-pr.sh`.
- Run `git diff --check`.