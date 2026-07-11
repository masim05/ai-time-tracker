# project-template

This repository is an AI-friendly project template for teams working in GitLab with multiple coding assistants.

## AI Flow: Quick Start

### 1. Install dependencies

To use this flow, install and configure one of the following AI agents, plus the `glab` CLI:

- GitHub Copilot
- Claude Code
- Codex
- `glab` CLI, used for GitLab comments and merge requests

### 2. Run the flow

1. GitHub Copilot in VS Code:
	- run `/ai-development-flow <task brief>` in chat.
	- entry point: `.github/prompts/ai-development-flow.prompt.md`.

2. Claude Code:
	- run `/ai-development-flow <task brief>` in Claude session from repository root.
	- entry point: `.claude/skills/ai-development-flow/SKILL.md`.

3. Codex (CLI/IDE/App):
	- run `$ai-development-flow <task brief>`.
	- if needed, use `/skills` and select `ai-development-flow`.
	- entry point: `.agents/skills/ai-development-flow/SKILL.md`.

### 3. Provide the task brief

Use this template with the command:

```md
Task type: <feat|change-request|bug|chore|docs>
Task title: <short title>
Context: <business/technical context>
Expected result: <what should be true after delivery>
Constraints: <known restrictions>
Out of scope: <what must not be changed>
Links: <issue, docs, related MR>
```

### What happens next

- AI Manager asks clarification questions labeled `[REQ]` or `[TECH]`.
- AI Developer implements the task and creates or updates the merge request.
- AI Reviewer reviews the changes and starts a fix-review loop when needed, up to 5 iterations.
- On success, the flow returns the merge request reference and `ready for Human Handoff` status.

### Human handoff

After the AI flow completes, a human must add a GitLab comment in the configured communication language with:
- human joined the process;
- current status (`approved` or `requires changes`);
- next action if changes are required.

All platform entry points follow `docs/engineering/ai-development-flow.md`, the source of truth for flow behavior.

## What this repository defines

- `AGENTS.md` is the common entrypoint for AI assistants.
- `docs/architecture/project-structure.md` defines the repository structure.
- `docs/engineering/definition-of-done/` defines task completion criteria.
- `docs/engineering/ai-development-flow.md` defines the single source-of-truth AI manager/developer/reviewer flow.
- `docs/ai/` stores role wrappers (prompts/skills/agents) that reference the single source-of-truth flow.
- `docs/engineering/testing-policy.md` defines testing and task-type change rules.
- `docs/work-items/` stores non-trivial work items and their artifacts.
- `.gitlab-ci.yml` runs repository policy checks in GitLab CI.
- `tmp/wts/` is the only allowed location for task worktrees used for actual implementation work.

## Start here

1. Read `AGENTS.md` if you are setting up or guiding an AI assistant.
2. Read `docs/architecture/project-structure.md`.
3. Read `docs/engineering/testing-policy.md`.
4. If using AI role workflow, read `docs/engineering/ai-development-flow.md`.
5. Read the relevant Definition of Done under `docs/engineering/definition-of-done/`.
6. Create a dedicated git worktree under `tmp/wts/<task-slug>/` before making any implementation changes.
7. Create or update a task work item under `docs/work-items/` when required.
8. Run the local CI-equivalent checks before every push.
9. After every push, verify that GitLab CI for the pushed commit is green.

## Workflow model

- GitLab is the source-of-truth platform for repository hosting, issues, merge requests, and CI.
- GitHub Copilot, Claude, and Codex may be used as assistants, but all of them must follow the same repository rules.
- All implementation work must happen in dedicated git worktrees under `tmp/wts/`; the primary checkout is not a valid workspace for task execution.

## Validation Before Push

Run local policy checks before each push:

```bash
scripts/check-architecture.sh
scripts/check-specs.sh
scripts/check-dod.sh
scripts/check-pr.sh
```
