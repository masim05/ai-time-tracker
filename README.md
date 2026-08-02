# ai-time-tracker

`ai-time-tracker` is a local, read-only CLI service that reports AI session activity time across Copilot CLI, Codex, and Claude Code from each developer machine.

## Cross-Agent Session Activity Report

`ai-time-tracker` includes a read-only CLI that reports agent-time,
human-active, inactive, and elapsed time across local GitHub Copilot CLI,
Codex (CLI and App), and Claude Code CLI sessions. All access is read-only and
offline; no session content (prompts, responses, source code, or tool output) is
read into diagnostics.

### Install and build

```bash
npm install
npm run build      # optional: compile to dist/ for a production run
```

### Run

```bash
npm run cli -- report [options]
npm run cli -- --help
npm run cli -- report --help
```

### Example output

```text
$ npm run cli -- report -a codex -f 2026-08-01 -t 2026-08-01-235959
launch  agent      path                 human  agent-time  start             duration  subagents
4baf32  codex-cli  ~/src/my-api            7m        34m   2026-08-01 09:12      58m          1
9e10a7  codex-app  ~/src/my-api            2m        11m   2026-08-01 13:44      23m          0
ab72fd  claude-cli ~/src/my-api            5m      1h47m   2026-08-01 16:20    1h08m          4
------------------------------------------------------------------------------------------------
total                                    14m      2h32m
```

### Options

- `-f, --from <when>` — start of the report period (inclusive).
- `-t, --to <when>` — end of the report period (inclusive).
- `-o, --output <format>` — `table` (default), `json`, or `csv`.
- `-p, --path <dir>` — restrict to launches under a directory (repeatable).
- `-a, --agent <name>` — restrict to interfaces/providers (repeatable).
- `-c, --columns <list>` — choose columns; prefix with `+`/`-` to add/remove
  from the defaults, or list explicit column ids to replace them.
- `-v, --verbose` — emit content-free diagnostics (provider, session id, file
  path, event type, timestamp, reason).

### Supported agent interfaces

| Value | Source | Notes |
| --- | --- | --- |
| `copilot-cli` | `~/.copilot/session-state/` | |
| `codex-cli`, `codex-app` | `~/.codex/` | |
| `claude-cli` | `~/.claude/projects/` | Developer-invoked Claude Code CLI, including its background jobs and sub-agents. |

Family selectors `copilot`, `codex`, and `claude` expand to their interfaces;
repeat `--agent` to select several.

Claude storage limitations:

- Sessions driven by an embedded Agent SDK (any `entrypoint` other than `cli`)
  are out of scope, as are Slack and CI agents. They are skipped and reported as
  a counted warning, never silently dropped.
- Resuming a session rewrites the previous launch's records into a new
  transcript; each record is counted once, for the launch that recorded it first.
- `claude-app` and `claude-vsc` are **not supported**: no local session data for
  the Claude desktop application or VS Code integration could be discovered on
  Linux or macOS. Selecting them is a usage error rather than an empty report.
  See `docs/architecture/decisions/ADR-0003-claude-session-storage.md`.

Accepted date/time formats: `YYYYMMDD`, `YYYYMMDD-HHmm`, `YYYYMMDD-HHmmss`,
`YYYY-MM-DD`, `YYYY-MM-DD-HHmm`, `YYYY-MM-DD-HHmmss`, and ISO 8601. A missing
time defaults to `00:00:00`; a missing timezone uses local time; a
DST-ambiguous local time without an offset is rejected.

Default columns: `launch, agent, path, human, agent-time, start,
duration, subagents`. Run `npm run cli -- report --help` for the full 16-column catalog.

Exit codes: `0` success, `1` partial failure (some sources unreadable), `2`
invalid usage.

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
- AI Manager prepares `spec.md`, `plan.md`, `test-plan.md`, and `e2e-scenarios.md`.
- AI Developer implements the task and creates or updates the merge request.
- After each developer code change, AI Reviewer and AI Tester both assess the MR and report either `consensus` or `changes required`.
- AI Manager orchestrates the developer-reviewer-tester loop until all actors reach consensus (or the iteration cap is hit).
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
- `docs/engineering/change-policy.md`: task-type change boundaries and review-blocking rules.
- `docs/engineering/testing-policy.md`: purpose-only placeholder for project-specific testing policy.
- `docs/engineering/definition-of-done/`: common and task-specific completion criteria.
- `docs/engineering/ai-development-flow.md`: source of truth for the Manager, Developer, Reviewer, and Tester flow.
- `docs/ai/`: platform and role wrappers for the AI development flow.
- `docs/work-items/`: specifications, plans, and delivery evidence for non-trivial work.

## Contributor Workflow

The configured Git platform is the source of truth for issues, merge/pull requests, discussions, and CI (`git.cli: glab` => GitLab, `git.cli: gh` => GitHub).

1. Classify the task as `feat`, `change-request`, `bug`, `chore`, or `docs`.
2. Read the relevant architecture, change policy, and Definition of Done documents from the repository guide.
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

## GitHub Actions CI

GitHub Actions runs workflow `CI` for:

- pull requests targeting `main`;
- pushes to `main`;
- manual runs via `workflow_dispatch`.

The workflow publishes two stable checks:

- `Application checks`: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`;
- `Repository policy checks`: `scripts/check-ai-flow-config.sh`,
  `tests/integration/check-ai-flow-config.sh`, `scripts/check-architecture.sh`,
  `scripts/check-specs.sh`, `scripts/check-dod.sh`, `scripts/check-pr.sh`.
