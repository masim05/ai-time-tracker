# Test Plan: Configurable GitLab Communication Language

## Integration Cases

- Missing configuration resolves to `en` and passes.
- Version 1 configuration without `gitlab.language` resolves to `en` and passes.
- `en`, `ru`, and `pt-BR` pass.
- Unsupported versions fail with an unsupported-version message.
- A language key outside the `gitlab` mapping fails with a malformed-structure message.
- Invalid tags such as `english`, `en_US`, and `en-` fail with an invalid-language message.
- Unknown keys and duplicate supported keys fail with actionable messages.

## Repository Checks

- The checked-in `.ai-flow.yml` passes direct validation.
- GitLab CI invokes both the validator and integration test.
- Existing architecture, work-item, Definition of Done, and merge-request policy checks remain green.
- Active policy and wrapper files contain no hardcoded Russian communication requirement.

## Manual Review

- README explains the configured language and English fallback.
- The source flow defines setting scope and resolution order once.
- Wrapper files do not duplicate the language policy.
- Historical work-item artifacts remain unchanged.