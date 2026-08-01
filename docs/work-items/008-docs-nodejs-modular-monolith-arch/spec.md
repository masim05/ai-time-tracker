# Spec: Define the Node.js Modular Monolith Architecture Policy

## Task type
`docs`

## Issue
https://github.com/masim05/ai-time-tracker/issues/1

## Summary
Define and document the Node.js modular monolith architecture for this repository. The initial deployment uses a single process and a shared PostgreSQL instance. Business capabilities are isolated by module. The structure must support future extraction of a module into a private npm package or an independently deployed API service with minimal changes to consuming business code.

## Intended audience
Developers, AI agents, and reviewers working in this repository.

## Required deliverables

### New or updated files in `docs/architecture/`

| File | Purpose |
|---|---|
| `docs/architecture/README.md` | Index of all architecture documents |
| `docs/architecture/overview.md` | System overview: topology, deployment model, data flow |
| `docs/architecture/principles.md` | Architecture principles (update with modular monolith principles) |
| `docs/architecture/boundaries.md` | Allowed dependency directions, forbidden patterns, public module API rules |
| `docs/architecture/project-structure.md` | Updated `apps/`, `modules/`, `packages/` topology and zone assignments |
| `docs/architecture/review-checklist.md` | Blocking architecture violations checklist |
| `docs/architecture/decisions/ADR-0002-modular-monolith.md` | Decision record for choosing a modular monolith |

## Detailed requirements

### Topology
- `apps/` — deployment units (entry points, DI wiring, transport setup)
- `modules/<name>/` — business capability modules, each a workspace package
- `packages/<name>/` — shared technical packages (utilities, types, adapters)

### Zone model per module
Every file in a module belongs to exactly one zone:
- `domain/` — entities, value objects, domain events, domain services; no framework/infra imports
- `application/` — use cases, application services, ports (interfaces); no infra/transport imports
- `infrastructure/` — adapters implementing ports (DB, external APIs, queues); may import domain/application
- `transport/` — HTTP/gRPC/event controllers; may import application ports only

### Dependency rules
- Allowed: `transport → application → domain`
- Allowed: `infrastructure → application → domain`
- Forbidden: `domain → application`, `domain → infrastructure`, `domain → transport`
- Forbidden: `application → infrastructure`, `application → transport`
- Forbidden: cross-module deep imports (only root `index.ts` is public)
- Forbidden: circular dependencies
- Forbidden: cross-module direct table access (each module owns its tables)
- Forbidden: uncontrolled dual writes across module boundaries

### Public module API
- Each module exposes only its root `index.ts` (or `index.js`)
- All cross-module calls go through the public API
- Internal paths are private by convention

### Cross-module calls and service extraction
- Local adapter: direct function/class call via public index
- Remote adapter: same interface, different implementation (HTTP client, message consumer)
- Extraction: swap the local adapter for a remote adapter; business code (application layer) is unchanged

### Database ownership
- Each module owns a set of tables (documented in module `README.md`)
- Cross-module table reads/writes go through the owning module's application layer
- Migrations are co-located with the owning module

### Exceptions
- Any exception to these rules requires an ADR

## Constraints
- English only
- Follow existing doc structure
- No code, test, infra, CI, or configuration changes
- Existing AI flow, work-item, DoD, and testing-policy structures must be preserved
