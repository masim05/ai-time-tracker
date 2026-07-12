# project-template

This repository is an AI-friendly project template for teams working in GitLab with multiple coding assistants.

## AI Flow: Required Setup

### 1. Install dependencies

To use this flow, install and configure one of the following AI agents, plus one supported Git platform CLI (`glab` or `gh`):

- GitHub Copilot
- Claude Code
- Codex
- `glab` CLI or `gh` CLI, used for Git platform comments and merge requests

Set the Git CLI with `git.cli` in `.ai-flow.yml`. It defaults to `glab` when the file or setting is absent.

## AI Flow: How To Run

### 1. Run the flow

1. GitHub Copilot in VS Code: run `/ai-development-flow <task brief>` in chat. Entry point: `.github/prompts/ai-development-flow.prompt.md`.
2. Claude Code: run `/ai-development-flow <task brief>` in a Claude session from repository root. Entry point: `.claude/skills/ai-development-flow/SKILL.md`.
3. Codex (CLI/IDE/App): run `$ai-development-flow <task brief>` (or use `/skills` and select `ai-development-flow`). Entry point: `.agents/skills/ai-development-flow/SKILL.md`.

### 2. Provide the task brief

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

### 3. What happens next

- AI Manager asks clarification questions labeled `[REQ]` or `[TECH]`.
- After clarifications, the flow creates or reuses `tmp/wts/<task-slug>/` before it writes work-item artifacts or implementation changes.
- AI Developer implements the task and creates or updates the merge request.
- AI Reviewer reviews the changes and starts a fix-review loop when needed, up to 5 iterations.
- On success, the flow returns the merge request reference and `ready for Human Handoff` status.

### 4. Human handoff

After the AI flow completes, a human must add a GitLab comment in the configured communication language with:

- human joined the process;
- current status (`approved` or `requires changes`);
- next action if changes are required.

Set the language with `gitlab.language` in `.ai-flow.yml`. It defaults to `en` when the file or setting is absent.

All platform entry points follow `docs/engineering/ai-development-flow.md`, the source of truth for flow behavior.

## Repository Guide

- `.ai-flow.yml`: optional repository settings for the AI flow; the checked-in template sets GitLab communication to English and Git CLI to `glab`.
- `AGENTS.md`: entrypoint and operating contract for AI assistants.
- `docs/architecture/`: project structure, boundaries, principles, and decisions.
- `docs/engineering/testing-policy.md`: test placement and task-type change rules.
- `docs/engineering/definition-of-done/`: common and task-specific completion criteria.
- `docs/engineering/ai-development-flow.md`: source of truth for the Manager, Developer, and Reviewer flow.
- `docs/ai/`: platform and role wrappers for the AI development flow.
- `docs/work-items/`: specifications, plans, test plans, and delivery evidence for non-trivial work.

## Contributor Workflow

GitLab is the source of truth for issues, merge requests, discussions, and CI.

1. Classify the task as `feat`, `change-request`, `bug`, `chore`, or `docs`.
2. Read the relevant architecture, testing, and Definition of Done documents from the repository guide.
3. If the workflow or task explicitly requires isolated execution, create or reuse a dedicated worktree under `tmp/wts/<task-slug>/` before implementation. `ai-development-flow` always does this automatically after clarification.
4. Create or update a work item under `docs/work-items/` when required, then implement the scoped change with its tests and documentation.
5. Run the validation commands below before every push, then verify that GitLab CI is green.

## Validation

Run local policy checks before each push:

```bash
scripts/check-ai-flow-config.sh
tests/integration/check-ai-flow-config.sh
scripts/check-architecture.sh
scripts/check-specs.sh
scripts/check-dod.sh
scripts/check-pr.sh
```
