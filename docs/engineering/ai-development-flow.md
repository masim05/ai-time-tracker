# AI Development Flow (Cross-Agent)

This document is the single source of truth for AI-assisted delivery flow in this repository.

Scope:
- task types: `feat`, `change-request`, `bug`, `chore`, `docs`;
- assistants: GitHub Copilot, Codex, Claude;
- the configured Git platform is the source of truth for issue tracking, merge/pull requests, discussions, and CI (`git.cli: glab` => GitLab, `git.cli: gh` => GitHub).

Important:
- AI-specific files must reference this document and must not duplicate this flow logic.

## Configuration

Before creating or updating GitLab content, resolve configuration from the repository root:

1. Read `gitlab.language` from `.ai-flow.yml` when the file and setting are present.
2. Otherwise, use `en`.
3. Read `git.cli` from `.ai-flow.yml` when the file and setting are present.
4. Otherwise, use `glab`.
5. If the configuration exists but fails `scripts/check-ai-flow-config.sh`, stop and report the validation error instead of guessing values.

The resolved GitLab communication language applies to merge request titles and descriptions, AI comments, review findings, replies, completion comments, and human handoff guidance. It does not control agent chat responses, source code, work-item artifacts, or general repository documentation.

The resolved Git CLI applies to Git platform operations executed by the AI flow (for example MR and comment operations) and must be one of `glab` or `gh`.

## Roles

- AI Manager: clarifies scope and requirements, then prepares required work-item artifacts.
- AI Developer: implements the task according to all project rules, pushes changes, and creates/updates MR.
- AI Reviewer: performs requirement/guideline/security review and leaves findings in GitLab.
- Human: joins after AI review loop and records final human handoff/decision in GitLab.

## Triggering The Flow

Recommended entry method: provide a task brief to AI Manager.

Preferred execution mode: single-command orchestration.

In single-command mode, one command starts the full flow. The agent asks Manager clarification questions, waits for user answers, then continues automatically through Developer and Reviewer stages (including the fix-review loop) until stop conditions are met.

Task brief template:

```md
Task type: <feat|change-request|bug|chore|docs>
Task title: <short title>
Context: <business/technical context>
Expected result: <what should be true after delivery>
Constraints: <known restrictions>
Out of scope: <what must not be changed>
Links: <issue, docs, related MR>
```

## Step 1: AI Manager Clarification And Artifacts

AI Manager must ask clarifying questions before implementation.

Question format requirements:
- each question must explicitly include one label:
  - `[REQ]` for functional/non-functional requirement clarifications;
  - `[TECH]` for technical/implementation clarifications.
- questions can be asked in small batches or one-by-one, but each question must keep the label.

When clarifications are complete, the flow must create or reuse a dedicated task worktree before writing any work-item artifacts or implementation changes:

```txt
tmp/wts/<task-slug>/
```

The primary checkout must not be used for artifacts or implementation created by an `ai-development-flow` run.

After clarifications, AI Manager must create or update a work item directory:

```txt
docs/work-items/NNN-<type>-<short-slug>/
```

Required artifacts for this flow:
- `spec.md`
- `plan.md`
- `artifacts/` (evidence directory for logs/screenshots/recordings)

Artifact content must be enough for implementation and review.

## Step 2: AI Developer Implementation And MR

AI Developer must:
- follow `AGENTS.md` and all referenced project rules;
- continue from the worktree created or reused in Step 1;
- keep task-type boundaries from `docs/engineering/change-policy.md`;
- update documentation when required;
- use the resolved GitLab communication language for merge request text, comments, and replies;
- push changes and create/update the MR in GitLab with verification details.

## Step 3: AI Reviewer Review In GitLab

AI Reviewer checks:
- conformance with task requirements and produced artifacts;
- conformance with all project guides/rules (including happy-path coverage/evidence);
- security risks (input validation, auth/access boundaries, secret handling, unsafe defaults, dependency/security regressions).

Review behavior:
- leave important findings in GitLab using the resolved communication language;
- prefer inline code comments where possible;
- resolve outdated/handled old review threads where possible.

## Step 4: Review-Fix Iteration Loop

Loop between AI Reviewer and AI Developer:
- AI Reviewer posts findings.
- AI Developer fixes, commits, pushes, and replies in GitLab using the resolved communication language.

Loop policy:
- maximum 5 iterations;
- stop earlier if there are no new unresolved critical/major findings.

## Step 5: Human Handoff (Mandatory)

After AI loop ends, human participation is mandatory and must be recorded as a GitLab comment in the resolved communication language.

Minimum handoff comment meaning:
- human joined review/approval process;
- current status (`approved` or `requires changes`);
- if changes required, short next action.

## Orchestrated Completion Signal

When AI Manager, AI Developer, and AI Reviewer complete successfully, the orchestrator must post a final user-facing summary that includes:
- merge request link/reference;
- short verification summary;
- explicit `ready for Human Handoff` status.

## Completion Checklist

Before considering task ready:
- all required artifacts exist in work item;
- MR discussion and comments from the AI cycle use the resolved communication language;
- reviewer findings are resolved or explicitly tracked;
- human handoff comment is present in GitLab;
- pushed commit has green GitLab CI.
