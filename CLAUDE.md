# Claude Instructions

Before generating or modifying code in this repository, read both:

- `README.md`
- `AGENTS.md`
- `docs/engineering/ai-development-flow.md` (single source-of-truth for AI role flow)
- `docs/ai/README.md` (role wrappers for prompts/skills/agents)

Claude-specific rules:

- Treat `AGENTS.md` as the source of truth for repository rules.
- Before push, run the same local checks expected by GitLab CI and confirm the pushed commit turns CI green.
Do not treat this file as a replacement for `AGENTS.md`.
