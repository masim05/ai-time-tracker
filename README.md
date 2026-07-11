# project-template

## AI Flow: Required Setup

Minimum setup for Copilot, Codex, and Claude:

1. Use this repository with AI instructions enabled (`AGENTS.md` plus agent-specific entrypoint files).
2. Ensure AI agents have access to:
	- repository files;
	- terminal commands;
	- Git operations;
	- GitLab (issues, merge requests, comments).
3. Use GitLab as source of truth for issues, MR discussion, and CI status.
4. Run task work only from a dedicated worktree in `tmp/wts/<task-slug>/`.
5. Use `docs/engineering/ai-development-flow.md` as the only flow logic source.
6. Keep all GitLab comments in Russian.

Native launch wrappers (no logic duplication, only references to source-of-truth):

- Copilot prompt: `.github/prompts/ai-development-flow.prompt.md`
- Claude skill: `.claude/skills/ai-development-flow/SKILL.md`
- Codex skill: `.agents/skills/ai-development-flow/SKILL.md`

## AI Flow: How To Run

Use single-command orchestration for `feat`, `change-request`, `bug`, `chore`, or `docs`.

### Native command by platform

1. GitHub Copilot in VS Code:
	- run `/ai-development-flow <task brief>` in chat.
	- provided by `.github/prompts/ai-development-flow.prompt.md`.

2. Claude Code:
	- run `/ai-development-flow <task brief>` in Claude session from repository root.
	- provided by `.claude/skills/ai-development-flow/SKILL.md`.

3. Codex (CLI/IDE/App):
	- explicit invocation is skill mention style: `$ai-development-flow <task brief>`.
	- if skill pick list is needed, use `/skills` and select `ai-development-flow`.
	- provided by `.agents/skills/ai-development-flow/SKILL.md`.

All three wrappers must follow `docs/engineering/ai-development-flow.md` and must not redefine flow logic.

### Single-Command Behavior

One command starts the full flow.

What happens next:
- AI Manager asks clarification questions (`[REQ]` and `[TECH]`) and waits for your answers.
- After your clarification answers, orchestration continues automatically through AI Developer and AI Reviewer.
- Review-fix loop runs automatically (up to 5 iterations, or earlier stop when no major findings remain).
- On successful completion, you receive MR reference plus explicit `ready for Human Handoff` status.

Human Handoff remains mandatory and is performed by a human in GitLab.

### Task Brief Template

Provide the task brief below when invoking the native command:

```md
Task type: <feat|change-request|bug|chore|docs>
Task title: <short title>
Context: <business/technical context>
Expected result: <what should be true after delivery>
Constraints: <known restrictions>
Out of scope: <what must not be changed>
Links: <issue, docs, related MR>
```

Manager reference files:
- `docs/engineering/ai-development-flow.md`
- `docs/ai/prompts/manager.md`
- `docs/ai/skills/manager/SKILL.md`

Expected result from Manager:
- clarification questions labeled `[REQ]` or `[TECH]`;
- prepared work-item artifacts in `docs/work-items/NNN-<type>-<short-slug>/`.

### Mandatory Human Handoff

After AI loop completion, a human must add a GitLab comment in Russian with:
- human joined the process;
- current status (`approved` or `requires changes`);
- next action if changes are required.

This repository is an AI-friendly project template for teams working in GitLab with multiple coding assistants.

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
