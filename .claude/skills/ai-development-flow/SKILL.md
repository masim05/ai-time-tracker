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

Execution requirements:
1. Follow Step 1 (AI Manager) first.
2. Clarification questions must include `[REQ]` or `[TECH]` labels.
3. Create/update required work-item artifacts from the source-of-truth.
4. After clarification answers are received, continue automatically with Developer and Reviewer stages.
5. Run review-fix loop automatically up to source-of-truth limits.
6. Stop only when AI Manager, AI Developer, and AI Reviewer complete successfully or when blocked.
7. On success, return MR reference and explicit `ready for Human Handoff` status.
