# Definition of Done: Docs

A documentation change is done only when:

- The documentation is accurate for the current project behavior.
- The intended audience is clear: users, developers, operators, reviewers, or AI agents.
- The changed document has a clear purpose.
- Links and references are valid.
- Examples, commands, paths, and configuration snippets are checked when practical.
- Terminology is consistent with the rest of the project.
- Outdated or conflicting information is removed or updated.
- No product code, tests, or infrastructure behavior is changed unless the task is reclassified from `docs` to another task type.
- The merge request explains what documentation changed and why.

A work item directory is required for docs changes that change project policy, architecture documentation, onboarding, or agent instructions:

```txt
docs/work-items/NNN-docs-<short-slug>/
```

## Blocking review conditions

The merge request must not be approved until these issues are resolved:

- Any code, test, infrastructure, CI, or configuration file was changed as part of a `docs` task.
- The task should be reclassified to another task type because it changes system behavior or delivery configuration.
