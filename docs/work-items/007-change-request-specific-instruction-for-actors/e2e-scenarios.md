# E2E Scenarios: Specific Instruction For Actors

## Scenario 1: Happy Path With Consensus

- Given a valid task brief
- When AI Manager completes clarifications and prepares artifacts
- And AI Developer submits code update
- And AI Reviewer returns `consensus`
- And AI Tester returns `consensus`
- Then AI Manager reports completion with `ready for Human Handoff`.

## Scenario 2: Reviewer Finds Issues

- Given AI Developer pushed a change
- When AI Reviewer returns `changes required`
- Then AI Manager invokes AI Developer with reviewer feedback
- And after developer pushes a fix, AI Manager invokes both AI Reviewer and AI Tester again.

## Scenario 3: Tester Finds Missing Evidence

- Given AI Developer pushed a change with incomplete testing evidence
- When AI Tester returns `changes required`
- Then AI Manager invokes AI Developer with tester feedback
- And after developer updates evidence/code, AI Manager invokes both AI Reviewer and AI Tester again.

## Scenario 4: Anti-Stall Orchestration

- Given any actor completes a step
- When the actor emits status (`consensus` or `changes required`)
- Then AI Manager immediately invokes the required next actor(s)
- And no state exists where progression depends on an implicit/unspecified trigger.

## Scenario 5: Iteration Cap

- Given repeated unresolved findings
- When the configured maximum iteration count is reached
- Then the flow stops with blocked status and unresolved findings summary.
