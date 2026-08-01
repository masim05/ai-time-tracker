# Plan: Define the Node.js Modular Monolith Architecture Policy

## Branch
`feat/008-docs-nodejs-modular-monolith-arch`

## Worktree
`tmp/wts/008-docs-nodejs-modular-monolith-arch/`

## Implementation steps

1. Create `docs/architecture/README.md` — index of all architecture documents
2. Update `docs/architecture/overview.md` — modular monolith system overview
3. Update `docs/architecture/principles.md` — add modular monolith principles
4. Update `docs/architecture/boundaries.md` — explicit dependency rules, forbidden patterns, public API policy, database ownership
5. Update `docs/architecture/project-structure.md` — add `apps/`, `modules/`, `packages/` topology and zone model
6. Create `docs/architecture/review-checklist.md` — blocking architecture violations
7. Create `docs/architecture/decisions/ADR-0002-modular-monolith.md` — decision record

## Commit strategy
Single commit: `docs: define Node.js modular monolith architecture policy`

## PR
Create PR on GitHub referencing issue #1.

## Out of scope
No code, tests, infra, CI, or configuration changes.
