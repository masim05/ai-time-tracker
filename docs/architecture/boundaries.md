# Architecture Boundaries

This document defines module boundaries, dependency rules, public API policy, data ownership, and adapter patterns.

## Dependency Direction Rules

### Allowed

- `cli/` → `application/` (invokes use cases via ports)
- `infrastructure/` → `application/` (implements ports)
- `infrastructure/` → `domain/` (may reference domain types)
- `application/` → `domain/` (operates on domain objects)

### Forbidden

| From | To | Reason |
|---|---|---|
| `domain/` | `application/` | Domain must be self-contained |
| `domain/` | `infrastructure/` | Domain must not depend on side-effect implementations |
| `domain/` | `cli/` | Domain must not know about CLI commands or output formats |
| `application/` | `infrastructure/` | Application defines ports; it must not import implementations |
| `application/` | `cli/` | Application must not know about CLI argument parsing or output formatting |
| Any zone | CLI framework/persistence driver/OS SDK | These belong only in `infrastructure/` and `cli/` |

## Cross-Module Boundary Rules

### Public Module API

- Each module exposes exactly one public surface: its root `index.ts` (or `index.js`).
- Consumers must only import from the module root, never from internal paths.
- Internal files (`domain/`, `application/`, `infrastructure/`, `cli/`) are private by convention.
- Violations of this rule are blocking in code review (see `review-checklist.md`).

### Forbidden Cross-Module Patterns

- **Deep imports:** `import { Foo } from 'modules/tracking/domain/Foo'` — forbidden.
- **Circular dependencies:** Module A imports Module B and Module B imports Module A — forbidden.
- **Direct data access:** Module A directly reads or writes data resources owned by Module B — forbidden.
- **Uncontrolled dual writes:** Two modules writing to the same data store resource outside a documented owned-by relationship — forbidden.

## Data Ownership

- Each module declares the data resources it owns in its `README.md`.
- Only the owning module's `infrastructure/` layer may read from or write to its data resources.
- Cross-module data access must go through the owning module's application layer (use cases or ports).
- Data migrations or schema definitions are co-located with the owning module (e.g., `modules/tracking/infrastructure/migrations/`).

## Adapter Patterns

### Local Adapter (default)

Used when both caller and callee run in the same process.

```
[modules/reporting/application/ports/ITrackingReader.ts]  ← interface
[modules/reporting/infrastructure/LocalTrackingAdapter.ts] ← implements ITrackingReader
                                                              calls modules/tracking public API
```

The application layer depends only on the port interface. The local adapter is injected at the CLI composition root.

### Package Adapter (after extraction)

Used after a module is extracted to a private npm package.

```
[modules/reporting/application/ports/ITrackingReader.ts]  ← interface (unchanged)
[modules/reporting/infrastructure/NpmTrackingAdapter.ts]  ← implements ITrackingReader
                                                              calls @scope/tracking package
```

Only the adapter implementation changes. The application layer (use cases) and domain layer are untouched.

## Exceptions

Any deviation from the rules in this document requires an Architecture Decision Record in `docs/architecture/decisions/` before implementation begins.
