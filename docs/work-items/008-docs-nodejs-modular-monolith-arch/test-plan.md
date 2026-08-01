# Test Plan: Define the Node.js Modular Monolith Architecture Policy

## Task type
`docs` — no code, tests, or infrastructure changes allowed.

## Verification approach
All verification is manual review of documentation artifacts.

## Checklist

### Completeness
- [ ] `docs/architecture/README.md` exists and indexes all architecture documents
- [ ] `docs/architecture/overview.md` describes topology, deployment model, and data flow
- [ ] `docs/architecture/principles.md` includes modular monolith principles
- [ ] `docs/architecture/boundaries.md` defines dependency directions, forbidden patterns, public API policy, database ownership
- [ ] `docs/architecture/project-structure.md` covers `apps/`, `modules/`, `packages/` topology and zone model
- [ ] `docs/architecture/review-checklist.md` lists blocking architecture violations
- [ ] `docs/architecture/decisions/ADR-0002-modular-monolith.md` records the decision

### Accuracy
- [ ] All cross-references and links between documents are valid
- [ ] Zone model (domain/application/infrastructure/transport) is consistent across documents
- [ ] Dependency rules are stated unambiguously and consistently
- [ ] Database ownership rules are clearly stated
- [ ] Local vs remote adapter pattern is described

### Consistency
- [ ] Terminology is consistent within all documents and with existing project docs
- [ ] No contradictions with `docs/architecture/principles.md` or `docs/architecture/boundaries.md`
- [ ] No code, test, infra, CI, or config files changed

### DoD compliance
- [ ] Docs Definition of Done satisfied (see `docs/engineering/definition-of-done/docs.md`)
- [ ] Work item directory exists with all required artifacts
