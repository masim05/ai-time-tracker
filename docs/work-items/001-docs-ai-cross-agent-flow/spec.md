# Spec: Cross-Agent AI Development Flow

## Goal

Define a single, AI-agnostic development flow for `feat`, `change-request`, `bug`, `chore`, and `docs` that works with Copilot, Codex, and Claude.

## Requirements

- One source-of-truth document for flow logic.
- AI-specific files must reference that source and must not duplicate flow logic.
- Manager role asks clarifying questions with explicit type labels (`[REQ]`, `[TECH]`).
- Required work-item artifacts are produced after clarification.
- Developer implements and creates/updates MR according to all project rules.
- Reviewer validates requirements/guides/security and happy-path evidence.
- Reviewer comments in GitLab (prefer inline), in Russian.
- Developer responds/fixes in Russian.
- Review/fix loop supports up to 5 iterations and can stop earlier when clean.
- Human handoff must be recorded as a GitLab comment in Russian.

## Out Of Scope

- Any product code changes.
- CI or infrastructure behavior changes.
