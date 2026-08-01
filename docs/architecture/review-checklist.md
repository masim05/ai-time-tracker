# Architecture Review Checklist

Use this checklist when reviewing pull requests or merge requests. All items marked **[BLOCKING]** must be resolved before the MR can be approved.

## Dependency Direction

- **[BLOCKING]** Does `domain/` import from `application/`, `infrastructure/`, `cli/`, a CLI framework, a persistence driver, or an external SDK?
- **[BLOCKING]** Does `application/` import from `infrastructure/`, `cli/`, a CLI framework, a persistence driver, or an external SDK?
- **[BLOCKING]** Does `cli/` import from `infrastructure/` or `domain/` directly (bypassing `application/`)?

## Cross-Module Imports

- **[BLOCKING]** Does any module import from another module's internal path (anything other than the root `index.ts`/`index.js`)?
- **[BLOCKING]** Is there a circular dependency between modules?

## Data Ownership

- **[BLOCKING]** Does any module's code directly access data resources owned by a different module?
- **[BLOCKING]** Is a data migration or schema definition placed outside the owning module's `infrastructure/migrations/` directory?
- **[BLOCKING]** Is there an uncontrolled dual write (two modules writing to the same data resource without a documented ownership agreement)?

## Public API Surface

- **[BLOCKING]** Does a module expose more than one public entry point (i.e., exports from multiple files instead of a single root `index.ts`)?

## Framework and Infra Independence

- **[BLOCKING]** Does `domain/` or `application/` reference a CLI framework (Commander, Yargs, Ink, etc.), a persistence driver, an OS integration library, or an external service SDK?

## Exceptions

- **[BLOCKING]** Does the PR deviate from any architectural rule without a corresponding ADR in `docs/architecture/decisions/`?

## Non-Blocking (Advisory)

- [ ] Is the module's owned data resources documented in the module's `README.md`?
- [ ] Is the public API surface of the module documented in the module's `README.md`?
- [ ] Are new cross-module adapter implementations documented?
- [ ] Is a new architectural exception tracked with an ADR?
