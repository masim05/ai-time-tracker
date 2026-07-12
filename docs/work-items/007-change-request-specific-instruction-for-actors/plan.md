# Plan: Specific Instruction For Actors

## Scope

Update source-of-truth and wrapper docs to support explicit tester phase and manager-orchestrated consensus loop.

## Steps

1. Update `docs/engineering/ai-development-flow.md`:
   - add AI Tester role;
   - define sub-agent-per-step orchestration;
   - define step input/output/DoD for Manager, Developer, Reviewer, Tester;
   - define manager-orchestrated multi-actor consensus loop.
2. Update repository-level references:
   - `README.md`
   - `AGENTS.md`
   - `docs/ai/README.md`
3. Update role wrappers:
   - adjust Developer/Reviewer step mappings;
   - add Tester role card, prompt, and skill wrapper.
4. Update platform wrappers:
   - `.github/prompts/ai-development-flow.prompt.md`
   - `.agents/skills/ai-development-flow/SKILL.md`
   - `.claude/skills/ai-development-flow/SKILL.md`
5. Add work-item evidence artifacts for this change request and run repository checks.

## Risks

- Risk: accidental duplication of source-of-truth logic in wrappers.
  - Mitigation: wrappers only declare scope and reference source-of-truth.
- Risk: inconsistent step numbering after adding tester phase.
  - Mitigation: update all role wrapper step references.

## Exit Criteria

- All targeted docs are updated consistently.
- Validation scripts pass.
