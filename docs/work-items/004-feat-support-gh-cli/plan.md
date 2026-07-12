# Configurable Git Platform CLI Implementation Plan

**Goal:** Add `git.cli` configuration support to `.ai-flow.yml` with `glab`/`gh` values and backward-compatible default `glab`.

**Architecture:** Extend the existing Bash config validator schema and tests, then update source-of-truth and onboarding documentation to describe resolution and usage.

**Tech Stack:** Bash 5.2, Markdown policy docs, existing CI policy checks.

## Global Constraints

- Keep `.ai-flow.yml` schema version at `1`.
- Preserve existing `gitlab.language` behavior and defaults.
- Avoid external dependencies.
- Keep changes scoped to config validation and documentation.

### Task 1: Validator Schema Extension

**Files:**

- Modify: `.ai-flow.yml`
- Modify: `scripts/check-ai-flow-config.sh`

- [x] Add optional `git` mapping with optional `cli` field.
- [x] Accept only `glab` and `gh` for `git.cli`.
- [x] Keep default CLI as `glab` when missing.
- [x] Include resolved CLI in validator success output.

### Task 2: Integration Test Coverage

**Files:**

- Modify: `tests/integration/check-ai-flow-config.sh`

- [x] Add passing cases for missing config, missing `git.cli`, explicit `glab`, and explicit `gh`.
- [x] Add failing cases for duplicate `git.cli`, malformed nesting, and invalid values.

### Task 3: Policy And Onboarding Documentation

**Files:**

- Modify: `docs/engineering/ai-development-flow.md`
- Modify: `README.md`

- [x] Document CLI resolution order and validation stop condition in source-of-truth flow.
- [x] Update setup instructions to support both `glab` and `gh`.
- [x] Avoid duplicated policy statements across files.

### Task 4: Verification

- [x] Run `scripts/check-ai-flow-config.sh`.
- [x] Run `tests/integration/check-ai-flow-config.sh`.
- [x] Run all policy checks from README validation block.
- [x] Run `git diff --check`.
