---
name: ai-development-flow
description: Run the repository AI development flow from a task brief. Use when user asks /ai-development-flow.
argument-hint: <task brief>
disable-model-invocation: true
---

Use the single source of truth for workflow logic:
- docs/engineering/ai-development-flow.md

Do not duplicate workflow logic from that document.

Task brief:
$ARGUMENTS

Execution requirements are defined in `docs/engineering/ai-development-flow.md`.
Worktree, autonomy, and terminal-state rules are mandatory per:
- `Worktree Gate (Mandatory)`
- `Autonomy Contract (Required)`
- `Blocked State Policy (Mandatory)`
- `Orchestrated Completion Signal`
