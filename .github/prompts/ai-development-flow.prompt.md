---
description: Run repository AI development flow for feat/change-request/bug/chore/docs from a task brief.
name: ai-development-flow
argument-hint: <task brief>
agent: agent
---

Run the repository AI development flow using the single source of truth:
- [ai-development-flow](../../docs/engineering/ai-development-flow.md)

Do not duplicate or invent workflow logic beyond that file.

Input task brief:
${input:task_brief:Task type, title, context, expected result, constraints, out of scope, links}

Execution rules are defined in [ai-development-flow](../../docs/engineering/ai-development-flow.md).
Worktree, autonomy, and terminal-state rules are mandatory per:
- `Worktree Gate (Mandatory)`
- `Autonomy Contract (Required)`
- `Blocked State Policy (Mandatory)`
- `Orchestrated Completion Signal`

User context:
$task_brief
