# Test Plan: Enforce autonomous AI flow docs

## Checks

- `scripts/check-specs.sh`
- `scripts/check-dod.sh`
- `scripts/check-pr.sh`

## Verification focus

- Work item naming and required policy docs remain valid.
- Flow source-of-truth includes autonomy, blocked-state, and terminal-state rules.
- Wrapper docs reference source-of-truth requirements without duplicating logic.
