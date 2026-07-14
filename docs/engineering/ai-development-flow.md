# AI Development Flow (Cross-Agent)

This document is the single source of truth for AI-assisted delivery flow in this repository.

Scope:
- task types: `feat`, `change-request`, `bug`, `chore`, `docs`;
- assistants: GitHub Copilot, Codex, Claude;
- the configured Git platform is the source of truth for issue tracking, merge/pull requests, discussions, and CI (`git.cli: glab` => GitLab, `git.cli: gh` => GitHub).
- actor roles: AI Manager, AI Developer, AI Reviewer, AI Tester.

Important:
- AI-specific files must reference this document and must not duplicate this flow logic.

Documentation boundary:
- this file owns normative flow policy (step order, handoff rules, stop conditions, completion criteria);
- role files under `docs/ai/` may define role scope and practical checklists, but must not redefine or fork normative flow behavior;
- if this document grows, split into linked engineering sub-documents and keep this file as the canonical index and policy entrypoint.

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

- AI Manager: clarifies scope and requirements, prepares required work-item artifacts, and orchestrates actor handoffs.
- AI Developer: implements the task according to all project rules, pushes changes, and creates/updates MR.
- AI Reviewer: performs requirement/guideline/security review and leaves findings in GitLab.
- AI Tester: verifies evidence and quality against test plan/e2e scenarios and leaves findings in GitLab.
- Human: joins after AI consensus loop and records final human handoff/decision in GitLab.

## Orchestration Model (Required)

To control context size and avoid stalled transitions:

- run each step in a dedicated sub-agent call with only the required step input package;
- return control to AI Manager after every actor step;
- require each actor to return either:
  - `consensus` (nothing to fix for this actor), or
  - `changes required` with actionable findings;
- after any AI Developer code change, AI Manager must invoke both AI Reviewer and AI Tester;
- AI Manager must explicitly trigger the next actor immediately after receiving the previous actor result.

This prevents deadlocks where one actor finishes but no next step is started.

## Triggering The Flow

Recommended entry method: provide a task brief to AI Manager.

Preferred execution mode: single-command orchestration.

In single-command mode, one command starts the full flow. The agent asks Manager clarification questions, waits for user answers, then continues automatically through Developer, Reviewer, and Tester stages (including the consensus loop) until stop conditions are met.

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

## Worktree Gate (Mandatory)

When `ai-development-flow` is invoked, the first required operational action is to create or reuse a dedicated task worktree:

```txt
tmp/wts/<task-slug>/
```

Rules:

- This gate is mandatory for every `ai-development-flow` run.
- The primary checkout must not be used for flow artifacts or implementation.
- The flow must not proceed to artifact writing or implementation until the worktree is ready.
- If worktree creation/reuse fails, terminate with `blocked` and report details using the blocked-state policy.

## Autonomy Contract (Required)

After clarification is complete, execution is autonomous and must not pause for intermediate user confirmation.

Required behavior:

- AI Manager must immediately continue orchestration through Developer, Reviewer, and Tester steps.
- Do not ask "continue?" or equivalent prompts between flow stages.
- Continue until one terminal state is reached:
  - `ready for Human Handoff`, or
  - `blocked`.

## Step 1: AI Manager Clarification And Artifacts

AI Manager must ask clarifying questions before implementation.

Question format requirements:
- each question must explicitly include one label:
  - `[REQ]` for functional/non-functional requirement clarifications;
  - `[TECH]` for technical/implementation clarifications.
- questions can be asked in small batches or one-by-one, but each question must keep the label.

The worktree gate from `Worktree Gate (Mandatory)` applies to this step and all following steps.

After clarifications, AI Manager must create or update a work item directory:

```txt
docs/work-items/NNN-<type>-<short-slug>/
```

Required artifacts for this flow:
- `spec.md`
- `plan.md`
- `test-plan.md`
- `e2e-scenarios.md`
- `artifacts/` (evidence directory for logs/screenshots/recordings)

Artifact content must be enough for implementation and review.

Step input:
- task brief;
- repository guides (start with `AGENTS.md` and `README.md`);
- clarification answers.

Step output:
- finalized clarification record;
- work-item artifact set (`spec.md`, `plan.md`, `test-plan.md`, `e2e-scenarios.md`);
- explicit handoff package for AI Developer.

Step DoD (verifiable):
- artifacts are complete, internally consistent, and testable;
- implementation and testing can start without unresolved ambiguity;
- AI Manager emits handoff package to AI Developer and immediately starts Step 2 without waiting for another user prompt.

## Step 2: AI Developer Implementation And MR

AI Developer must:
- follow `AGENTS.md` and all referenced project rules;
- continue from the worktree created or reused in Step 1;
- keep task-type boundaries from `docs/engineering/change-policy.md`;
- update documentation when required;
- use the resolved GitLab communication language for merge request text, comments, and replies;
- push changes and create/update the MR in GitLab with verification details.

Step input:
- output of Step 1 (`spec.md`, `plan.md`, `test-plan.md`, `e2e-scenarios.md`);
- findings from AI Reviewer and AI Tester from prior iterations;
- repository guides.

Step output:
- code implementation pushed to MR/PR branch;
- self-test evidence aligned with `test-plan.md`;
- actor status to AI Manager:
  - `consensus`, or
  - `changes required` with implementation update summary.

Step DoD (verifiable):
- exactly one outcome is produced:
  - `consensus` message to AI Manager when no code change is needed, or
  - code fixes are committed/pushed, Git platform comments are updated, and control is returned to AI Manager;
- every code change is accompanied by updated implementation notes and verification evidence.

## Step 3: AI Reviewer Review In GitLab

AI Reviewer checks:
- conformance with task requirements and produced artifacts;
- conformance with all project guides/rules (including happy-path coverage/evidence);
- security risks (input validation, auth/access boundaries, secret handling, unsafe defaults, dependency/security regressions).

Review behavior:
- leave important findings in GitLab using the resolved communication language;
- prefer inline code comments where possible;
- resolve outdated/handled old review threads where possible.

Step input:
- output of Step 1 (`spec.md`, `plan.md`, `test-plan.md`, `e2e-scenarios.md`);
- MR/PR changes;
- repository guides.

Step output:
- assessment of business logic correctness, repository rule conformance, security risks, and style consistency;
- actor status to AI Manager:
  - `consensus`, or
  - `changes required` with actionable findings in Git platform comments.

Step DoD (verifiable):
- exactly one outcome is produced:
  - `consensus` message to AI Manager when review is clear, or
  - findings are posted (inline when possible) and control is returned to AI Manager.

## Step 4: AI Tester Validation In GitLab

AI Tester checks:
- evidence of testing against `test-plan.md` and `e2e-scenarios.md`;
- required testing artifacts and traceability from requirements to test evidence;
- business logic correctness based on available test evidence.

Validation behavior:
- leave important findings in GitLab using the resolved communication language;
- prefer inline comments where possible;
- request missing evidence explicitly when tests are claimed but not demonstrated.

Step input:
- output of Step 1 (`spec.md`, `plan.md`, `test-plan.md`, `e2e-scenarios.md`);
- MR/PR changes and attached test evidence.

Step output:
- assessment of testing completeness and evidence quality;
- actor status to AI Manager:
  - `consensus`, or
  - `changes required` with actionable findings in Git platform comments.

Step DoD (verifiable):
- exactly one outcome is produced:
  - `consensus` message to AI Manager when test evidence is sufficient, or
  - findings are posted (inline when possible) and control is returned to AI Manager.

## Step 5: Manager-Orchestrated Consensus Loop

Loop between AI Developer, AI Reviewer, and AI Tester, orchestrated by AI Manager:
- AI Manager invokes AI Developer.
- If AI Developer makes code changes, AI Manager invokes both AI Reviewer and AI Tester.
- AI Reviewer and AI Tester each return `consensus` or `changes required`.
- If either reviewer or tester requests changes, AI Manager invokes AI Developer again with both feedback sets.
- AI Manager repeats until all three actors return `consensus`.

Loop policy:
- maximum 5 iterations;
- stop earlier if there are no new unresolved critical/major findings and all three actors have `consensus`.
- if iteration limit is reached without full consensus, stop and report blocked status with outstanding findings.

## Blocked State Policy (Mandatory)

If the flow cannot complete due to environment, tooling, access, or policy constraints, the orchestrator must end in `blocked` and provide:

- the exact failed step;
- blocker details with observed error/symptom;
- what is already completed;
- what is required to resume from the blocked point.

Missing Git platform access (for example unavailable or unauthenticated `glab`/`gh`) is not a reason to pause silently; it must produce explicit `blocked` output.

## Step 6: Human Handoff (Mandatory)

After AI loop ends with full actor consensus, human participation is mandatory and must be recorded as a GitLab comment in the resolved communication language.

Minimum handoff comment meaning:
- human joined review/approval process;
- current status (`approved` or `requires changes`);
- if changes required, short next action.

## Orchestrated Completion Signal

The orchestrator must finish with exactly one terminal state:

- `ready for Human Handoff` when AI Manager, AI Developer, AI Reviewer, and AI Tester complete successfully;
- `blocked` when mandatory flow completion is impossible.

Terminal output requirements:

- For `ready for Human Handoff`, include merge request link/reference and short verification summary.
- For `blocked`, include blocked-state details from the blocked state policy section.

## Completion Checklist

Before considering task ready:
- all required artifacts exist in work item;
- MR discussion and comments from the AI cycle use the resolved communication language;
- reviewer and tester findings are resolved or explicitly tracked;
- human handoff comment is present in GitLab;
- pushed commit has green GitLab CI.
