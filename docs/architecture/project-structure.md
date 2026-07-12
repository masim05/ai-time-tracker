# Project Structure

This document defines the required repository structure.

## Root files

- `README.md` — human-facing project overview.
- `AGENTS.md` — common contract for all AI agents.
- `CLAUDE.md` — Claude-specific entrypoint that links to `AGENTS.md`.
- `CODEX.md` — Codex-specific entrypoint that links to `AGENTS.md`.
- `.ai-flow.yml` — optional repository-specific AI flow configuration; omitted settings use documented defaults.
- `.github/copilot-instructions.md` — GitHub Copilot-specific entrypoint that links to `AGENTS.md`.
- `.gitlab-ci.yml` — GitLab CI pipeline for repository policy checks.

## Required directories

```txt
repo/
  README.md
  AGENTS.md
  CLAUDE.md
  CODEX.md
  .ai-flow.yml

  .github/
    copilot-instructions.md
    prompts/
      ai-development-flow.prompt.md

  .claude/
    skills/
      ai-development-flow/
        SKILL.md

  .agents/
    skills/
      ai-development-flow/
        SKILL.md
        agents/
          openai.yaml

  .gitlab/
    issue_templates/
      feature.md
      change-request.md
      bug.md
      chore.md
      docs.md
    merge_request_templates/
      default.md

  docs/
    ai/
      README.md
      prompts/
      skills/
      agents/

    architecture/
      overview.md
      principles.md
      boundaries.md
      project-structure.md
      decisions/

    engineering/
      ai-development-flow.md
      change-policy.md
      definition-of-done/
        README.md
        feature.md
        change-request.md
        bugfix.md
        chore.md
        docs.md
      testing-policy.md

    work-items/
      README.md
      NNN-<type>-<short-slug>/

  src/
    ...

  tests/
    integration/
      check-ai-flow-config.sh
    e2e/

  tmp/
    wts/
      <task-slug>/

  scripts/
    check-ai-flow-config.sh
```

## Work Items Structure

Work items are organized as a single chronological work stream.

Pattern:

```txt
docs/work-items/NNN-<type>-<short-slug>/
```

Allowed task types:

- `feat`
- `change-request`
- `bug`
- `chore`
- `docs`

Examples:

- `docs/work-items/001-feat-login/`
- `docs/work-items/002-change-request-checkout-copy/`
- `docs/work-items/003-bug-user-cant-login/`
- `docs/work-items/004-chore-docker-tools/`
- `docs/work-items/005-docs-api-readme/`

## Work Item Requirements

A work item directory is required for:

- every feature;
- every change request;
- every non-trivial bugfix;
- every risky chore;
- every docs change that changes project policy, architecture documentation, onboarding, or agent instructions.

A work item directory is optional for:

- typo fixes;
- small obvious bugfixes;
- mechanical cleanup;
- simple dependency bumps;
- small docs edits.

## Worktree Policy

`ai-development-flow` work must happen in dedicated git worktrees under:

```txt
tmp/wts/<task-slug>/
```

Rules:

- `ai-development-flow` creates or reuses the task worktree before writing work-item artifacts or implementation changes.
- The primary checkout of the repository must not be used for artifacts or implementation produced by an `ai-development-flow` run.
- Outside `ai-development-flow`, use dedicated worktrees when the task or requester explicitly requires isolated execution.
- Parallel work by humans and multiple AI assistants must use separate worktrees.
- Worktree paths under `tmp/wts/` are local working areas and must not become the source of truth for durable project documentation.
