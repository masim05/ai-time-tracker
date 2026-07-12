# E2E Scenarios: AI Flow Worktree Policy

## AI Flow Creates Or Reuses Worktree Before Artifacts

1. A user starts `ai-development-flow` with a task brief.
2. AI Manager asks the required clarification questions.
3. After clarifications are complete, the flow creates or reuses `tmp/wts/<task-slug>/`.
4. The flow writes or updates the work-item artifacts from that worktree.
5. AI Developer continues implementation from the same worktree instead of the primary checkout.

## Non-Flow Work Remains Request-Driven

1. A user asks for normal repository work without invoking `ai-development-flow`.
2. The agent follows the task request directly.
3. A worktree is created only when the user or the task explicitly asks for isolated execution.