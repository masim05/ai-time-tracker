# Test Plan: Specific Instruction For Actors

## Objective

Verify that the documentation flow now enforces a four-actor loop (Manager, Developer, Reviewer, Tester) with explicit handoffs and non-stalling orchestration.

## Checks

1. Source-of-truth flow integrity
   - Confirm `docs/engineering/ai-development-flow.md` includes:
     - AI Tester role;
     - per-step input/output/DoD;
     - manager-orchestrated consensus loop;
     - reviewer+tester invoked after each developer code change.
2. Wrapper alignment
   - Confirm all wrappers reference source-of-truth and include tester where applicable.
3. Entry-point alignment
   - Confirm `.github`, `.agents`, and `.claude` flow wrappers require four-actor completion.
4. Repository policy checks
   - Run local validation scripts listed in `README.md`.

## Expected Result

Documentation and wrapper files are consistent, with no conflicting flow definitions.
