# AI Prompts, Skills, And Agents

This directory contains role wrappers for AI Manager, AI Developer, AI Reviewer, and AI Tester.

Single source of truth:
- `docs/engineering/ai-development-flow.md`

Rule:
- do not duplicate or fork flow logic in role files;
- update flow rules only in the single source-of-truth document;
- role files may define only role scope, inputs, and outputs, then reference the source-of-truth sections.

Required flow references for wrappers:
- `Worktree Gate (Mandatory)` in `docs/engineering/ai-development-flow.md`;
- `Autonomy Contract (Required)` in `docs/engineering/ai-development-flow.md`;
- `Blocked State Policy (Mandatory)` in `docs/engineering/ai-development-flow.md`;
- `Orchestrated Completion Signal` terminal states.

Practical guidance:
- keep normative flow policy in `docs/engineering/ai-development-flow.md`;
- keep role-specific execution notes/checklists in role wrappers when they do not alter policy.

Native platform launch wrappers are stored here:
- Copilot: `.github/prompts/ai-development-flow.prompt.md`
- Claude: `.claude/skills/ai-development-flow/SKILL.md`
- Codex: `.agents/skills/ai-development-flow/SKILL.md`

Contents:
- `prompts/` - copy-paste prompts for each role.
- `skills/` - role skill wrappers that point to the same flow policy.
- `agents/` - agent role cards for manager/developer/reviewer/tester.
