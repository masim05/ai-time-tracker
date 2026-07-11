# Configurable GitLab Communication Language Implementation Plan

**Goal:** Make GitLab-facing AI flow communication language configurable through `.ai-flow.yml`, with English as the fallback.

**Architecture:** A small Bash validator owns the supported configuration schema and can validate either the repository default file or an explicit test fixture. The source-of-truth flow document defines how agents resolve and apply the language; wrappers and role prompts reference that policy without hardcoding a language.

**Tech Stack:** Bash 5.2, YAML subset configuration, Markdown policy documents, GitLab CI.

## Global Constraints

- Default resolved language is `en` when the file or `gitlab.language` is absent.
- Checked-in configuration is version `1` with `gitlab.language: en`.
- Language values use BCP 47-style tags such as `en`, `ru`, and `pt-BR`.
- Historical work items remain unchanged.
- No external parser or package dependency is added.

### Task 1: Configuration Validator

**Files:**
- Create: `.ai-flow.yml`
- Create: `scripts/check-ai-flow-config.sh`
- Create: `tests/integration/check-ai-flow-config.sh`

- [x] Write an integration test covering missing configuration, omitted language, valid tags, unsupported versions, malformed structure, and invalid tags.
- [x] Run the integration test and confirm it fails because the validator does not exist.
- [x] Implement the minimal validator for the version 1 schema.
- [x] Run the integration test and direct repository validation until both pass.

### Task 2: CI And Repository Structure

**Files:**
- Modify: `.gitlab-ci.yml`
- Modify: `docs/architecture/project-structure.md`
- Modify: `README.md`

- [x] Add the validator and its integration test to the policy-check job.
- [x] Document `.ai-flow.yml`, the validator, and the integration test in the project structure.
- [x] Document the default and configurable GitLab communication language in README.

### Task 3: Flow Policy And Wrappers

**Files:**
- Modify: `docs/engineering/ai-development-flow.md`
- Modify: `docs/ai/prompts/manager.md`
- Modify: `docs/ai/prompts/developer.md`
- Modify: `docs/ai/prompts/reviewer.md`
- Modify: `.github/prompts/ai-development-flow.prompt.md`
- Modify: `.claude/skills/ai-development-flow/SKILL.md`
- Modify: `.agents/skills/ai-development-flow/SKILL.md`

- [x] Define configuration resolution once in the source-of-truth flow.
- [x] Replace active hardcoded Russian requirements with the resolved GitLab communication language.
- [x] Remove duplicated language rules from native wrappers.
- [x] Confirm Russian references remain only in historical work items and the current-state description in this work item.

### Task 4: Verification

- [x] Run `bash tests/integration/check-ai-flow-config.sh`.
- [x] Run `scripts/check-ai-flow-config.sh`.
- [x] Run all four local CI-equivalent policy checks.
- [x] Run `git diff --check`.
- [x] Audit acceptance criteria and active language references.