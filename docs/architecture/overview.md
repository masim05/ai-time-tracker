# Architecture Overview

## Deployment Model

The application is a **Node.js CLI tool** structured as a modular monolith: a single executable that runs as a user-invoked process. All business modules run in the same process and communicate in-process through stable public APIs.

The structure is designed so that any module can be extracted into a private npm package with minimal changes to consuming business code.

## Topology

```
repo/
  apps/           # CLI entry points: argument parsing, DI composition root, process setup
  modules/        # Business capability modules; each is a workspace package
  packages/       # Shared technical packages: utilities, types, shared adapters
```

### `apps/`
- Contains the CLI entry point (e.g., `apps/cli/`).
- Responsible for wiring modules together (dependency injection), registering commands, and starting the process.
- Must not contain business logic.

### `modules/`
- Each subdirectory is a self-contained business capability module (e.g., `modules/tracking/`, `modules/reporting/`).
- Modules are workspace packages from the beginning, enabling extraction with minimal friction.
- Each module owns its data and public API.

### `packages/`
- Shared technical packages that are not specific to a single business capability.
- Examples: `packages/logger/`, `packages/storage/`, `packages/types/`.
- Must not contain business logic.

## Zone Model

Every file inside a module belongs to exactly one zone:

| Zone | Contents | Allowed imports |
|---|---|---|
| `domain/` | Entities, value objects, domain events, domain services | Nothing outside `domain/`; no framework, infra, or CLI imports |
| `application/` | Use cases, application services, ports (interfaces) | `domain/` only; no infra or CLI imports |
| `infrastructure/` | Adapters implementing ports (local storage, external APIs, OS integrations) | `domain/`, `application/` |
| `cli/` | Command handlers, argument parsing, output formatting | `application/` ports only |

## Data Flow

```
[CLI layer]
    ↓ calls
[Application layer] ← ports (interfaces)
    ↓ depends on
[Domain layer]

[Infrastructure layer] → implements ports → [Application layer]
```

User commands enter via the CLI layer, are dispatched to application use cases, which operate on domain objects. Infrastructure adapters implement the ports defined in the application layer.

## External Dependencies

- **Node.js runtime** — single-process host for all modules.

External SDKs, persistence drivers, OS integrations, and CLI frameworks are confined to `infrastructure/` and `cli/` zones and must not appear in `domain/` or `application/`.

## Operational Assumptions

- Single-process CLI invocation is the runtime model.
- Cross-module communication is in-process via public module APIs (local adapters).
- When a module is extracted to a private npm package, local adapters are replaced with the package import; business code (application layer) is unchanged.
