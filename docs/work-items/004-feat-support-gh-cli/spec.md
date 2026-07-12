# Spec: Configurable Git Platform CLI (glab or gh)

## Goal

Allow the repository AI flow to select the Git platform CLI through `.ai-flow.yml`, supporting both `glab` and `gh` while keeping backward-compatible defaults.

## Current Behavior

- The quick start documentation requires `glab` explicitly.
- `.ai-flow.yml` validates only `version` and `gitlab.language`.
- There is no repository-level setting that declares which Git platform CLI should be used by the flow.

## Requested Behavior

Add a repository AI flow setting for the CLI tool:

```yaml
version: 1

git:
  cli: glab

gitlab:
  language: en
```

Behavior requirements:

- Supported values are `glab` and `gh`.
- If `.ai-flow.yml` is missing, default CLI resolves to `glab`.
- If `.ai-flow.yml` exists without `git.cli`, default CLI resolves to `glab`.
- Invalid values fail validation with a clear error message.

## Configuration Resolution

- Read `git.cli` from `.ai-flow.yml` when present.
- Fallback value is `glab` when missing.
- Validation is performed by `scripts/check-ai-flow-config.sh`.

## Acceptance Criteria

- `.ai-flow.yml` may define `git.cli` as `glab` or `gh`.
- Validation passes for valid values and fails for invalid values.
- Integration tests cover default, `glab`, `gh`, and invalid values.
- README setup instructions document both CLI options and the default.
- AI flow source-of-truth documentation includes the CLI resolution rule without duplicating logic elsewhere.

## Out Of Scope

- Replacing GitLab as the source of truth.
- Rewriting historical work-item artifacts.
- Adding runtime wrapper-specific command execution logic in this change.
