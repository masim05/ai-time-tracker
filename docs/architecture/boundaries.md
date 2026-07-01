# Architecture Boundaries

This document defines module and dependency boundaries.

Until a concrete application architecture is defined, use these default rules:

- Keep domain or business logic independent from infrastructure details.
- Keep external service calls behind adapters or clients.
- Do not let UI or transport layers own business rules.
- Do not introduce cross-module imports that create circular dependencies.
- Prefer dependency direction from outer layers toward stable inner abstractions.

Update this document when the project architecture becomes more specific.
