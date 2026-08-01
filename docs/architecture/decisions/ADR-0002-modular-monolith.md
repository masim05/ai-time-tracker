# ADR-0002: Modular Monolith

## Status

Accepted

## Context

The project is a new Node.js application. The team needs an architecture that:

- Isolates business capabilities to prevent uncontrolled coupling.
- Keeps the initial operational complexity low (single process).
- Allows any module to be extracted into a private npm package or an independently deployed API service in the future, with minimal changes to consuming business code.
- Supports clean testability by keeping domain and application logic independent of frameworks, ORMs, and transport protocols.

A microservices architecture was not chosen for the initial phase because:

- Distributed tracing, inter-service contracts, and independent deployment pipelines add significant operational overhead before product-market fit.
- A well-structured monolith with explicit module boundaries provides equivalent isolation benefits at lower cost.

A traditional layered monolith (without module boundaries) was not chosen because:

- It tends to accumulate cross-cutting coupling over time.
- Extraction to services later becomes prohibitively expensive.

## Decision

Start as a **Node.js modular monolith** with the following structure:

- `apps/` — deployment units (entry points, DI composition root, transport setup).
- `modules/` — business capability modules; each is a workspace package with an explicit zone model (domain, application, infrastructure, transport) and a single public `index.ts`.
- `packages/` — shared technical packages without business logic.

Each module:

- Owns its data resources and public API.
- Exposes only its root `index.ts` as a public API.
- Contains framework- and infra-independent domain and application layers.
- Uses port interfaces in the application layer so that local adapters can be replaced with remote adapters when the module is extracted.

## Consequences

### Positive

- Business capability isolation is enforced by explicit boundary rules from day one.
- Domain and application code can be unit-tested without persistence or framework setup.
- Extracting a module to a service requires only replacing local adapters with remote adapters; application and domain layers are unchanged.
- Modules are workspace packages, so extraction to a private npm package requires only publishing, not restructuring.
- A single deployment unit keeps initial DevOps complexity low.

### Negative

- More upfront structural discipline is required compared to a flat monolith.
- In-process module calls must still follow the public API contract (no internal path imports), which requires ongoing review enforcement.
- If a shared persistence layer is introduced, schema changes affecting multiple modules must be coordinated.

### Neutral

- Cross-module transactions require application-layer coordination (e.g., sagas or explicit two-phase logic) if strong consistency is needed after service extraction.
- Performance bottlenecks must be addressed at the module level first; service extraction is a scaling option, not the default.

## Exceptions

Any deviation from the modular monolith boundary rules defined in `docs/architecture/boundaries.md` must be documented in a new ADR before implementation.
