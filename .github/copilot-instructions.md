# GitHub Copilot Instructions

Before generating or modifying code in this repository, read both:

- `README.md`
- `AGENTS.md`
- `docs/engineering/ai-development-flow.md` (single source-of-truth for AI role flow)
- `docs/ai/README.md` (role wrappers for prompts/skills/agents)

Copilot-specific rules:

- Use GitHub Copilot only as the coding assistant; GitLab remains the source of truth for issues, merge requests, and CI.
- Follow the repository's GitLab issue and merge request flow for delivery artifacts and review.
- Before push, run the same local checks expected by GitLab CI and confirm the pushed commit turns CI green.
Do not treat this file as a replacement for `AGENTS.md`.
