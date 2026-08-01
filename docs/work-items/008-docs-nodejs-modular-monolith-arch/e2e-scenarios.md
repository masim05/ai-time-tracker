# E2E Scenarios: Define the Node.js Modular Monolith Architecture Policy

## Task type
`docs` — all scenarios are manual documentation review scenarios.

---

## Scenario 1: Developer onboarding using architecture docs

**Actor:** New developer joining the project.

**Steps:**
1. Read `docs/architecture/README.md`.
2. Follow links to `overview.md`, `principles.md`, `boundaries.md`, `project-structure.md`.
3. Read `review-checklist.md` to understand what violations are blocking.
4. Read `ADR-0002-modular-monolith.md` to understand the architectural decision.

**Expected outcome:**
- Developer understands the `apps/`, `modules/`, `packages/` topology.
- Developer knows which zone (domain/application/infrastructure/transport) to place new code.
- Developer knows which dependency directions are allowed and which are forbidden.
- Developer can identify a blocking architecture violation using the checklist.

---

## Scenario 2: AI agent generates a new module

**Actor:** AI Developer agent.

**Steps:**
1. Read `docs/architecture/project-structure.md` for zone and topology rules.
2. Read `docs/architecture/boundaries.md` for dependency and public API rules.
3. Generate a new module scaffold under `modules/<name>/`.

**Expected outcome:**
- Scaffold matches the documented zone layout.
- Module exposes only `index.ts` publicly.
- No cross-module deep imports or circular dependencies are introduced.

---

## Scenario 3: Reviewer uses checklist to evaluate a PR

**Actor:** AI Reviewer.

**Steps:**
1. Read `docs/architecture/review-checklist.md`.
2. Apply each blocking violation check to the PR diff.

**Expected outcome:**
- Reviewer can unambiguously classify each check as pass or fail.
- No blocking violations are present.

---

## Scenario 4: Service extraction (future)

**Actor:** AI Developer agent.

**Steps:**
1. Read the local vs remote adapter pattern from `docs/architecture/boundaries.md`.
2. Swap a local adapter for a remote adapter in `modules/<name>/infrastructure/`.

**Expected outcome:**
- Application layer code (use cases) is unchanged.
- Domain code is unchanged.
- Only infrastructure and transport layers change.
