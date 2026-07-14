# Spec: Enforce autonomous AI flow

## Task

Enforce autonomous execution of `ai-development-flow` from post-clarification to terminal state, without intermediate user prompts.

## Context

- Flow policy source of truth: `docs/engineering/ai-development-flow.md`
- Wrapper docs and launch prompts must reference the same rules.

## Requirements

- Add explicit autonomy contract after clarifications.
- Define mandatory blocked-state behavior when flow cannot proceed.
- Define exact terminal states for orchestrator completion output.
- Ensure wrappers reference these requirements without duplicating policy logic.

## Expected outcome

- Flow policy clearly prevents early pauses.
- Future runs terminate only with `ready for Human Handoff` or `blocked`.
