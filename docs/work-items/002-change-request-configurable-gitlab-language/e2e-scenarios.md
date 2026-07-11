# E2E Scenarios: Configurable GitLab Communication Language

## Configured Repository Language

1. A repository maintainer sets `gitlab.language` in `.ai-flow.yml` to a valid BCP 47-style tag.
2. Local and GitLab policy checks validate the configuration.
3. An AI development flow starts through any supported platform wrapper.
4. The agent reads the source-of-truth flow and resolves the configured language.
5. Merge request text, AI review comments, replies, and completion comments use that language.
6. Human handoff guidance requests a comment in the same configured language.

## Default Language

1. A repository adopting the template omits `.ai-flow.yml` or `gitlab.language`.
2. The validator and flow resolve the language to `en`.
3. New GitLab-facing communication is written in English.