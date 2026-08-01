# Architecture Overview

## Deployment Model

The application starts as a **Node.js modular monolith**: a single deployable process. All business modules run in the same process and communicate in-process through stable public APIs.

The structure is designed so that any module can be extracted into a private npm package or an independently deployed API service with minimal changes to consuming business code.

## Topology

```
repo/
  apps/           # Deployment units: entry points, DI composition root, transport setup
  modules/        # Business capability modules; each is a workspace package
  packages/       # Shared technical packages: utilities, types, shared adapters
```

### `apps/`
- Contains one or more deployment units (e.g., `apps/api/`).
- Each app is responsible for wiring modules together (dependency injection), configuring transports, and starting the process.
- Apps must not contain business logic.

### `modules/`
- Each subdirectory is a self-contained business capability module (e.g., `modules/billing/`, `modules/users/`).
- Modules are workspace packages from the beginning, enabling extraction with minimal friction.
- Each module owns its data and public API.

### `packages/`
- Shared technical packages that are not specific to a single business capability.
- Examples: `packages/logger/`, `packages/db-client/`, `packages/types/`.
- Must not contain business logic.

## Zone Model

Every file inside a module belongs to exactly one zone:

| Zone | Contents | Allowed imports |
|---|---|---|
| `domain/` | Entities, value objects, domain events, domain services | Nothing outside `domain/`; no framework, infra, or transport imports |
| `application/` | Use cases, application services, ports (interfaces) | `domain/` only; no infra or transport imports |
| `infrastructure/` | Adapters implementing ports (DB, external APIs, queues, message brokers) | `domain/`, `application/` |
| `transport/` | HTTP/gRPC/event controllers, request/response mapping | `application/` ports only |

## Data Flow

```
[Transport layer]
    ↓ calls
[Application layer] ← ports (interfaces)
    ↓ depends on
[Domain layer]

[Infrastructure layer] → implements ports → [Application layer]
```

External requests enter via transport, are dispatched to application use cases, which operate on domain objects. Infrastructure adapters implement the ports defined in the application layer.

## External Dependencies

- **Node.js runtime** — single-process host for all modules.

External SDKs, ORMs, HTTP frameworks, and persistence drivers are confined to `infrastructure/` and `transport/` zones and must not appear in `domain/` or `application/`.

## Operational Assumptions

- Single-process deployment is the initial model; horizontal scaling is out of scope until service extraction.
- Cross-module communication is in-process via public module APIs (local adapters).
- When a module is extracted to a separate service, local adapters are replaced with remote adapters (HTTP client, message consumer) without touching the application layer.
