# End-to-end scenarios — 011 chore: GitHub Actions CI

## E1 — Pull request trigger

Create or update a pull request targeting `main`.

Expected:

- workflow `CI` starts automatically;
- jobs `Application checks` and `Repository policy checks` run;
- failing command marks the workflow failed.

## E2 — Push trigger

Push a commit directly to `main` (or observe via protected flow in a maintainer
context).

Expected: workflow `CI` starts automatically for the push.

## E3 — Manual trigger

Run `CI` from the Actions UI (`workflow_dispatch`).

Expected: workflow starts and executes both jobs.

## E4 — Concurrency cancellation

Push two commits quickly to the same PR branch.

Expected: earlier in-progress workflow run is canceled after newer run starts.
