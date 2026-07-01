# AI Agent Contract

This file is the common entrypoint and shared contract for all AI assistants working in this repository.

Agent-specific files such as `CLAUDE.md`, `CODEX.md`, and `.github/copilot-instructions.md` may add tool-specific guidance, but they must not override this contract.

## Required reading

Before changing project structure, creating files, adding tests, or implementing non-trivial work, read:

- `README.md`
- `docs/architecture/project-structure.md`
- `docs/architecture/boundaries.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/ai-development-flow.md` (when using the AI manager/developer/reviewer workflow)
- `docs/ai/README.md` (role wrappers for prompts/skills/agents)
- `docs/engineering/definition-of-done/README.md`
- the task-specific Definition of Done:
  - `docs/engineering/definition-of-done/feature.md`
  - `docs/engineering/definition-of-done/change-request.md`
  - `docs/engineering/definition-of-done/bugfix.md`
  - `docs/engineering/definition-of-done/chore.md`
  - `docs/engineering/definition-of-done/docs.md`

## Non-negotiable rules

- Follow the repository structure defined in `docs/architecture/project-structure.md`.
- Do not create centralized `tests/unit/` or `tests/component/` directories.
- Unit and component tests must live next to the code they test.
- Integration tests must live in `tests/integration/`.
- E2E tests must live in `tests/e2e/`.
- Non-trivial work must have a work item directory under `docs/work-items/`.
- All changes must be made from a dedicated git worktree under `tmp/wts/<task-slug>/`.
- Do not implement tasks from the primary checkout of the repository.
- Keep changes focused on the requested task.
- Do not include unrelated refactoring, formatting, or behavior changes.
- Update documentation when behavior, architecture, public API, configuration, or operating process changes.
- Before every push, run the local CI-equivalent checks that match the repository's GitLab CI policy checks.
- After every push, verify that GitLab CI for the pushed commit is green before treating the task as ready for review or complete.
- Violations of task-type change boundaries are blocking in review and must be resolved before merge.

## Task workflow

1. Identify the task type: `feat`, `change-request`, `bug`, `chore`, or `docs`.
2. Read the common Definition of Done.
3. Read the task-specific Definition of Done.
4. Create or switch to a dedicated git worktree under `tmp/wts/<task-slug>/`.
5. Create or update a work item directory when required.
6. Implement the change according to architecture boundaries from that worktree only.
7. Add or update tests according to the testing policy.
8. Update documentation when required.
9. Run the local CI-equivalent checks before every push.
10. Push only after those checks pass.
11. Verify that GitLab CI for the pushed commit is green.
12. Prepare a merge request that links to the relevant work item and explains verification.

## Work items

Work items are organized as a single chronological work stream:

```txt
docs/work-items/NNN-<type>-<short-slug>/
```

Allowed task types:

- `feat`
- `change-request`
- `bug`
- `chore`
- `docs`
