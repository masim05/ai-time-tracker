# Architecture Boundaries

This document defines module boundaries, dependency rules, public API policy, database ownership, and adapter patterns.

## Dependency Direction Rules

### Allowed

- `transport/` → `application/` (calls use cases via ports)
- `infrastructure/` → `application/` (implements ports)
- `infrastructure/` → `domain/` (may reference domain types)
- `application/` → `domain/` (operates on domain objects)

### Forbidden

| From | To | Reason |
|---|---|---|
| `domain/` | `application/` | Domain must be self-contained |
| `domain/` | `infrastructure/` | Domain must not depend on side-effect implementations |
| `domain/` | `transport/` | Domain must not know about transport protocols |
| `application/` | `infrastructure/` | Application defines ports; it must not import implementations |
| `application/` | `transport/` | Application must not know about HTTP, gRPC, or event transports |
| Any zone | Framework/ORM/SDK | Frameworks belong only in `infrastructure/` and `transport/` |

## Cross-Module Boundary Rules

### Public Module API

- Each module exposes exactly one public surface: its root `index.ts` (or `index.js`).
- Consumers must only import from the module root, never from internal paths.
- Internal files (`domain/`, `application/`, `infrastructure/`, `transport/`) are private by convention.
- Violations of this rule are blocking in code review (see `review-checklist.md`).

### Forbidden Cross-Module Patterns

- **Deep imports:** `import { Foo } from 'modules/billing/domain/Foo'` — forbidden.
- **Circular dependencies:** Module A imports Module B and Module B imports Module A — forbidden.
- **Direct table access:** Module A reads or writes tables owned by Module B — forbidden.
- **Uncontrolled dual writes:** Two modules writing to the same table outside a documented owned-by relationship — forbidden.

## Database Ownership

- Each module declares the tables it owns in its `README.md`.
- Only the owning module's `infrastructure/` layer may read from or write to its tables.
- Cross-module data access must go through the owning module's application layer (use cases or ports).
- Migrations are co-located with the owning module (e.g., `modules/billing/infrastructure/migrations/`).

## Adapter Patterns

### Local Adapter (default)

Used when both caller and callee run in the same process.

```
[modules/orders/application/ports/IPaymentService.ts]  ← interface
[modules/orders/infrastructure/LocalPaymentAdapter.ts] ← implements IPaymentService
                                                         calls modules/billing public API
```

The application layer depends only on the port interface. The local adapter is injected at the app composition root.

### Remote Adapter (service extraction)

Used after a module is extracted to an independent service.

```
[modules/orders/application/ports/IPaymentService.ts]  ← interface (unchanged)
[modules/orders/infrastructure/HttpPaymentAdapter.ts]  ← implements IPaymentService
                                                         calls billing service via HTTP
```

Only the adapter implementation changes. The application layer (use cases) and domain layer are untouched.

## Exceptions

Any deviation from the rules in this document requires an Architecture Decision Record in `docs/architecture/decisions/` before implementation begins.
