# AI Agent Contract

This file is the canonical entrypoint and operating contract for AI assistants working in this repository.

Start with `README.md` for the project overview, AI flow quick start, shared contributor workflow, and validation commands. This file adds only AI-specific instructions.

## Required reading

Before implementing non-trivial work, read:

- `README.md` in full;
- the relevant architecture, testing, and Definition of Done documents identified in its Repository Guide;
- the AI development flow and role-wrapper documentation from that guide when the Manager, Developer, Reviewer, and Tester workflow is used.

## Agent Operating Rules

- Follow the Contributor Workflow in `README.md`; do not restate or fork it in agent-specific files.
- Treat the linked architecture, testing, Definition of Done, and AI flow documents as authoritative for their domains.
- Keep platform entrypoints such as `CLAUDE.md`, `CODEX.md`, and `.github/copilot-instructions.md` limited to platform-specific guidance and references to this contract.
- Keep changes focused on the requested task.
- Do not include unrelated refactoring, formatting, or behavior changes.
- Preserve user-authored changes and work with a dirty worktree without reverting unrelated edits.
- Report assumptions, blockers, and verification results explicitly.

## AI Development Flow

When the AI Manager, Developer, Reviewer, and Tester workflow is invoked, follow the source-of-truth flow document identified in the README Repository Guide. Role prompts, skills, and platform wrappers may define entrypoints and role scope, but must not duplicate flow policy.
