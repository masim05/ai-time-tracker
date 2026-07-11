# Spec: Configurable GitLab Communication Language

## Goal

Replace the hardcoded Russian-language requirement with one repository-level AI flow setting. GitLab-facing communication defaults to English and can be configured with a BCP 47 language tag.

## Current Behavior

- AI flow policy, native launch wrappers, and role prompts hardcode Russian for GitLab comments and replies.
- README requires the human handoff comment to be in Russian.
- The same language rule is duplicated across multiple files and can drift.

## Requested Behavior

Add a root `.ai-flow.yml` configuration file:

```yaml
version: 1

gitlab:
  language: en
```

The resolved `gitlab.language` controls all GitLab-facing communication created as part of the AI flow:

- merge request titles and descriptions;
- AI Manager, Developer, and Reviewer comments;
- review replies and resolution comments;
- completion and handoff comments;
- README guidance for the mandatory human handoff.

Agent chat responses, source code, work-item artifacts, and general repository documentation are outside this setting.

## Configuration Resolution

- `.ai-flow.yml` is optional for repositories adopting this template.
- If the file or `gitlab.language` is absent, the resolved language is `en`.
- The checked-in template includes `.ai-flow.yml` with `gitlab.language: en` so the default is visible and easy to customize.
- A configured value must be a syntactically valid BCP 47-style language tag such as `en`, `ru`, or `pt-BR`.
- Unsupported configuration versions, malformed YAML structure, and invalid language tags fail the repository policy check with an actionable error.

## Architecture

- `.ai-flow.yml` owns repository-specific AI flow settings.
- `docs/engineering/ai-development-flow.md` remains the single source of truth for configuration resolution and language behavior.
- Native launch wrappers and role prompts reference the resolved language from the source flow and contain no hardcoded language.
- `scripts/check-ai-flow-config.sh` validates the checked-in configuration without adding a runtime or package dependency.
- `.gitlab-ci.yml` runs the configuration check with the existing policy checks.

## Acceptance Criteria

- The root configuration sets `gitlab.language` to `en`.
- English is documented as the fallback when the file or key is missing.
- All active AI flow policy, wrapper, prompt, and README language requirements use the configured language instead of Russian.
- The policy checker accepts `en`, `ru`, and `pt-BR`.
- The policy checker rejects an unsupported version, malformed structure, and invalid language tags with non-zero exit status and clear messages.
- Existing policy checks remain green.
- Historical work-item artifacts remain unchanged because they record the requirements under which that completed work was delivered.

## Test Strategy

- Add integration coverage under `tests/integration/` that copies the checker into temporary repositories and exercises valid, missing, and invalid configuration cases.
- Run the checker directly against the repository default configuration.
- Run all local CI-equivalent policy checks.

## Risks And Edge Cases

- A generic environment variable such as `LANGUAGE` is intentionally not used because it conflicts with shell locale conventions and is not repository-scoped.
- The checker validates the intentionally small schema rather than exposing arbitrary YAML configuration.
- Language selection does not translate fixed repository content; it instructs agents which language to use for newly generated GitLab communication.

## Out Of Scope

- Translating existing documentation or historical work items.
- Configuring agent chat language or source-code language.
- Per-role or per-user language overrides.
- Automatically detecting language from user messages or GitLab metadata.