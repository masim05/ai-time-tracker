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

Execution rules:
1. Start with AI Manager behavior from the source-of-truth flow.
2. Ask clarification questions with explicit labels `[REQ]` or `[TECH]`.
3. Create/update required work-item artifacts as defined in the source-of-truth flow.
4. Continue automatically with Developer and Reviewer stages after clarifications are answered.
5. Run review-fix iterations automatically up to source-of-truth limits.
6. Stop only when AI Manager, AI Developer, and AI Reviewer all complete successfully or when blocked.
7. On success, return MR reference and explicit `ready for Human Handoff` status.

User context:
$task_brief
