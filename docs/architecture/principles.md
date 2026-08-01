# Architecture Principles

This document defines the architecture principles for the project.

## General Principles

- **Keep boundaries explicit.** Every dependency direction, ownership rule, and public API surface must be stated in writing. Unwritten assumptions become violations.
- **Prefer simple, testable modules.** Prefer small, focused modules over large, multi-purpose ones. Testability is a first-class design criterion.
- **Keep side effects at the edges.** Domain and application layers must not produce side effects (I/O, network, persistence). Side effects belong in `infrastructure/` and `transport/`.
- **Make important decisions visible through ADRs.** Any significant architectural choice must be recorded in `docs/architecture/decisions/`.
- **Do not introduce dependencies without a clear reason.** Every new dependency must be justified. Transitive dependencies are subject to the same scrutiny.

## Modular Monolith Principles

- **One module per business capability.** A module encapsulates one cohesive area of business functionality. Cross-capability logic belongs in a shared service or a new module.
- **Stable public APIs.** Each module exposes exactly one public entry point: its root `index.ts` (or `index.js`). All other files are internal. Consumers must not import internal paths.
- **Module-first, extraction-ready.** Modules are workspace packages from the start. Extraction to a private npm package or an independent service must require only adapter changes, not business logic changes.
- **Framework and infra independence in domain and application layers.** `domain/` and `application/` must import nothing from HTTP frameworks, ORMs, persistence drivers, external SDKs, or transport protocols. These concerns belong in `infrastructure/` and `transport/`.
- **No shared mutable state across modules.** Modules must not share in-memory state, singletons, or event buses beyond explicitly documented contracts.
- **Explicit cross-module calls.** Cross-module interactions must go through the owning module's public API. Direct data access, internal path imports, and undocumented coupling are forbidden.
- **Data ownership is per module.** Each module owns a declared set of data resources. Other modules must not read or write those resources directly; they must call the owning module's application layer.
- **Exceptions require an ADR.** Any deviation from these rules must be documented in an Architecture Decision Record before implementation.
