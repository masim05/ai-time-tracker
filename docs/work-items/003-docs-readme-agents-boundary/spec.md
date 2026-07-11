# Spec: README And AGENTS Audience Boundary

## Goal

Make README the human-facing project entrypoint and AGENTS the canonical AI-agent entrypoint without duplicating shared workflow instructions.

## Current State

- README mixes quick-start guidance, repository orientation, contributor workflow, and AI-agent setup.
- AGENTS repeats task classification, worktree, work-item, testing, validation, and delivery instructions already represented in README or linked policy documents.
- README sections are not ordered as a coherent human journey because `Start here` appears after the quick start and repository inventory.

## Requested State

- README follows an action-first structure: AI Flow Quick Start, Repository Guide, Contributor Workflow, then Validation.
- README owns shared contributor workflow and validation commands.
- AGENTS points to README for shared workflow and contains only AI-specific operating rules and required policy links.
- Platform-specific agent files continue to point to AGENTS as the common contract.
- Shared workflow content has one owner and is referenced rather than copied.

## Acceptance Criteria

- README has no standalone `Start here` or `Workflow model` section.
- README presents contributor steps in execution order.
- AGENTS does not repeat task type lists, worktree paths, work-item naming, test placement, validation commands, or push/CI steps owned by README and linked policy documents.
- AGENTS clearly identifies README as the source for shared contributor workflow and validation.
- AGENTS retains AI-specific scope, focus, preservation, reporting, and flow-source rules.
- All repository policy checks pass.

## Out Of Scope

- Changing project behavior, CI, scripts, or configuration.
- Rewriting architecture, testing, Definition of Done, or AI flow policy.
- Changing platform-specific agent entrypoints.