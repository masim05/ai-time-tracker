# Architecture Documentation

This directory contains the architecture documentation for the project.

## Documents

| Document | Purpose |
|---|---|
| [overview.md](overview.md) | High-level system overview: topology, deployment model, data flow, and external dependencies |
| [principles.md](principles.md) | Architecture principles that guide all design decisions |
| [boundaries.md](boundaries.md) | Module and dependency boundaries, public API rules, data ownership, and adapter patterns |
| [project-structure.md](project-structure.md) | Repository layout, `apps/`, `modules/`, `packages/` topology, and zone model |
| [review-checklist.md](review-checklist.md) | Blocking architecture violations checklist for code review |
| [decisions/](decisions/) | Architecture Decision Records (ADRs) |

## Decisions

| ADR | Title |
|---|---|
| [ADR-0001](decisions/ADR-0001-project-structure.md) | Project Structure |
| [ADR-0002](decisions/ADR-0002-modular-monolith.md) | Modular Monolith |
| [ADR-0002](decisions/ADR-0002-session-storage-formats.md) | Session Storage Formats (Copilot, Codex) — number collides with the entry above |
| [ADR-0003](decisions/ADR-0003-claude-session-storage.md) | Claude Code Session Storage And Identity |
