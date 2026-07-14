# Spec: Enforce worktree gate for ai-development-flow

## Task

Enforce a strict policy that every `ai-development-flow` run must create or reuse a dedicated worktree.

## Requirements

- Add explicit mandatory worktree gate in the source-of-truth flow policy.
- Make blocked behavior explicit when worktree setup fails.
- Update wrappers to reference the worktree gate section.

## Expected outcome

`ai-development-flow` policy is unambiguous: no run proceeds without worktree creation/reuse.
