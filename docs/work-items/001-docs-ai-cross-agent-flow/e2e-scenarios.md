# E2E Scenarios

This is a docs-only task.

No product/system E2E execution is required.

Happy-path documentation scenario:
1. AI Manager receives task brief and asks labeled clarification questions (`[REQ]`, `[TECH]`).
2. AI Manager creates required work-item artifacts.
3. AI Developer implements via worktree and updates MR.
4. AI Reviewer leaves Russian findings in GitLab and checks happy-path evidence.
5. AI Developer fixes and responds in Russian.
6. Loop repeats (max 5) until no major findings remain.
7. Human posts Russian handoff comment in GitLab.
