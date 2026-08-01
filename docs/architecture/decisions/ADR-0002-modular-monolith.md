# ADR-0002: Modular Monolith

## Status

Accepted

## Context

The project is a Node.js CLI tool for AI-assisted time tracking. The team needs an architecture that:

- Isolates business capabilities to prevent uncontrolled coupling.
- Keeps the initial operational complexity low (single CLI process, no server infrastructure).
- Allows any module to be extracted into a private npm package in the future, with minimal changes to consuming business code.
- Supports clean testability by keeping domain and application logic independent of CLI frameworks, persistence drivers, and external SDKs.

A microservices or multi-process architecture was not chosen because:

- A CLI tool operates as a single user-invoked process; distributed infrastructure adds complexity with no benefit at this scale.
- A well-structured single process with explicit module boundaries provides equivalent isolation at lower cost.

A traditional flat monolith (without module boundaries) was not chosen because:

- It tends to accumulate cross-cutting coupling over time.
- Extraction of capabilities to separate npm packages later becomes prohibitively expensive.

## Decision

Structure the CLI tool as a **Node.js modular monolith** with the following layout:

- `apps/cli/` — CLI entry point: DI composition root, command registration, process setup.
- `modules/` — business capability modules; each is a workspace package with an explicit zone model (domain, application, infrastructure, cli) and a single public `index.ts`.
- `packages/` — shared technical packages without business logic.

Each module:

- Owns its data resources and declares them in its `README.md`.
- Exposes only its root `index.ts` as a public API.
- Contains CLI-framework- and infra-independent domain and application layers.
- Uses port interfaces in the application layer so that local adapters can be replaced with npm package adapters when the module is extracted.

The CLI layer (`cli/`) replaces the transport layer used in server architectures. It handles command parsing, flag validation, and output formatting, calling application use cases via ports.

## Consequences

### Positive

- Business capability isolation is enforced by explicit boundary rules from day one.
- Domain and application code can be unit-tested without CLI framework or persistence setup.
- Extracting a module to a private npm package requires only replacing local adapters with package imports; application and domain layers are unchanged.
- Modules are workspace packages, so extraction requires only publishing, not restructuring.
- Single-process CLI invocation keeps DevOps complexity minimal.

### Negative

- More upfront structural discipline is required compared to a flat CLI script.
- Cross-module calls must still follow the public API contract; no internal path imports, which requires ongoing review enforcement.

### Neutral

- Cross-module state consistency must be handled at the application layer (e.g., explicit coordination between use cases) if needed.

## Exceptions

Any deviation from the modular monolith boundary rules defined in `docs/architecture/boundaries.md` must be documented in a new ADR before implementation.
