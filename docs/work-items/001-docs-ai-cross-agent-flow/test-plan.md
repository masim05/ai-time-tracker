# Test Plan

## Documentation Verification

- Check all new links resolve to existing files.
- Verify AI-specific files reference source-of-truth document and do not contain duplicated flow rules.
- Verify required role wrappers exist:
  - prompts: manager/developer/reviewer
  - skills: manager/developer/reviewer
  - agents: manager/developer/reviewer

## Policy Verification

- Run repository policy scripts:
  - `scripts/check-architecture.sh`
  - `scripts/check-specs.sh`
  - `scripts/check-dod.sh`
  - `scripts/check-pr.sh`
