# Spec: AI Flow Worktree Policy

## Goal

Make `ai-development-flow` create or reuse a dedicated task worktree immediately after clarification and before any work-item artifacts or implementation work are written.

## Current Behavior

- Repository docs require worktrees in several places, but they do not clearly state when `ai-development-flow` must create or reuse one.
- The current wording can be read as either a general repository-wide requirement or a manual contributor step.
- Work-item artifacts can therefore be created from the primary checkout before a task worktree exists.

## Requested Behavior

- When `ai-development-flow` is invoked, it must create or reuse `tmp/wts/<task-slug>/` immediately after the clarification stage.
- All work-item artifacts for that flow run must be created or updated from that worktree, not from the primary checkout.
- AI Developer implementation for that flow continues from the same worktree.
- Outside `ai-development-flow`, worktree creation remains request-driven rather than automatic.

## Acceptance Criteria

- `docs/engineering/ai-development-flow.md` states that the flow creates or reuses the task worktree before writing work-item artifacts.
- `README.md` explains that automatic worktree creation applies to `ai-development-flow`, while other workflows create worktrees only when explicitly requested.
- Architecture, Definition of Done, and MR template wording no longer imply that every task always requires an automatically created worktree.
- AI role wrapper docs do not duplicate outdated worktree logic.
- Repository policy checks pass after the documentation update.

## Out Of Scope

- Rewriting historical work-item artifacts to match the new wording.
- Adding new automation outside the documented `ai-development-flow` policy.
- Changing GitLab/GitHub CLI behavior.