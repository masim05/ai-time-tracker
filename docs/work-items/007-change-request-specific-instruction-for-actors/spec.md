# Spec: Specific Instruction For Actors

## Metadata

- Task type: `change-request`
- Task title: `specific instruction for actors`

## Context

The current AI development flow has manager, developer, and reviewer phases. For large features, context can be lost. The flow must be split into stricter phase contracts, include an explicit tester phase before human handoff, and use step-scoped sub-agent execution to control context size.

## Clarifications

- [REQ] Should tester run on every developer code change or only before handoff?
  - Answer: Tester runs on every developer code change.
- [REQ] Should actor completion be binary (`consensus` vs `changes required`)?
  - Answer: Yes.
- [TECH] What prevents the orchestration from getting stuck between actors?
  - Answer: AI Manager is the explicit orchestrator and must trigger the next actor immediately after each actor result.

## Required Behavior

1. AI flow includes four AI roles: Manager, Developer, Reviewer, Tester.
2. Each step defines explicit input, output, and verifiable DoD.
3. Output of each step becomes input of the next step.
4. AI Manager orchestrates all transitions and re-invocations.
5. AI Reviewer and AI Tester are both invoked on every AI Developer code change.
6. Each actor returns exactly one status per run:
   - `consensus`, or
   - `changes required`.
7. Loop continues until Developer, Reviewer, and Tester all reach `consensus`, or iteration limit is reached.
8. Sub-agent-per-step model is required for context control.

## Non-Goals

- No changes to task-type taxonomy.
- No changes to CLI configuration behavior.

## Acceptance Criteria

- `docs/engineering/ai-development-flow.md` documents tester step and manager-orchestrated consensus loop.
- Step definitions include explicit input/output/DoD and handoff contract.
- Role wrapper docs under `docs/ai/` include tester role and updated step mapping.
- Platform flow wrappers (`.github`, `.agents`, `.claude`) require Manager+Developer+Reviewer+Tester completion.
- `README.md` references tester in AI flow summary and source-of-truth description.
