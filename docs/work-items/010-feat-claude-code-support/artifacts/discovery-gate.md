# Discovery gate — Claude Code interfaces

Method: read-only inspection of a developer machine's local Claude Code storage
(Linux, Claude Code 2.1.220). Only structural metadata, field names, and counts
were extracted. No prompt, response, source-code, or tool-output content was
copied into this repository.

Reference machine totals: 646 project directories, 2,678 transcript files,
2,462 top-level session files, 216 sub-agent transcripts.

## Per-interface outcome

| Requirement (#3 gate) | `claude-cli` | `claude-app` | `claude-vsc` |
| --- | --- | --- | --- |
| Local storage location | ✅ `~/.claude/projects/…` | ❌ none found | ❌ none found |
| Recognizable format | ✅ JSONL, typed records | ❌ | ❌ |
| Session / invocation ids | ✅ `sessionId`, `uuid`, `~/.claude/sessions/<pid>.json` | ❌ | ❌ |
| Launch / prompt / response / cancel / fail timestamps | ✅ per-record ISO-8601 `timestamp` | ❌ | ❌ |
| Working-directory changes | ✅ per-record `cwd` | ❌ | ❌ |
| Parent / sub-agent relationships | ✅ `subagents/` + `meta.json` `toolUseId` | ❌ | ❌ |
| Sufficient evidence for all measurements | ✅ | ❌ | ❌ |

`claude-app` and `claude-vsc` fail the gate: the machine has no Claude desktop
application storage (`~/.config/Claude`, `~/.claude/ide` absent) and no Claude
VS Code extension (`~/.vscode/extensions`, `~/.vscode-server/extensions` carry
no Anthropic extension). Every one of the 72,170 `entrypoint` values found in
local transcripts is `cli` (29,441) or `sdk-cli` (42,729) — no desktop or IDE
entrypoint value could be observed, so no mapping can be verified. macOS uses
the same `$HOME/.claude` layout, so the same conclusion applies there; only the
base directory differs by home path.

## `claude-cli` evidence

### Storage layout

```txt
~/.claude/projects/<project-slug>/<sessionId>.jsonl          # launch transcript
~/.claude/projects/<project-slug>/<sessionId>/subagents/
        agent-<agentId>.jsonl                                # sub-agent transcript
        agent-<agentId>.meta.json                            # {agentType, description, toolUseId}
~/.claude/sessions/<pid>.json                                # live launch registry
```

### Record fields (top-level keys observed)

`type`, `sessionId`, `uuid`, `parentUuid`, `timestamp`, `cwd`, `entrypoint`,
`version`, `gitBranch`, `isSidechain`, `userType`, `message`, `requestId`,
`promptId`, `promptSource`, `permissionMode`, `sessionKind`, `toolUseResult`,
`sourceToolAssistantUUID`, `sourceToolUseID`, `isMeta`, `agentId`.

Record `type` values: `user`, `assistant`, `attachment`, `system`, `ai-title`,
`last-prompt`, `queue-operation`, `permission-mode`, `mode`, `agent-name`,
`file-history-snapshot`, `file-history-delta`, `pr-link`, `relocated`,
`worktree-state`, `agent-setting`.

### Interface attribution

`entrypoint` distinguishes the driver. Observed values and their nature on the
reference machine:

| `entrypoint` | Session files | What it is |
| --- | --- | --- |
| `cli` | 48 (17 interactive + 31 `sessionKind: bg`) | Developer-invoked Claude Code CLI, including its own background jobs. |
| `sdk-cli` | 2,414 | Agent-SDK embedder. Here: a Slack bot spawning one headless session per user question (median 12 records, exactly one `promptSource: sdk` prompt each, concentrated in one product repository and its worktrees). Out of scope per #3 ("Slack or CI agents"). |

### Human prompts

Candidate human-prompt records across `cli` sessions by `promptSource`:
`typed` 138, absent 51, `system` 82, `queued` 7, `suggestion_accepted` 1.
`system` records are injected notifications (task notifications, command
stdout), not human input, and are excluded.

### Launch identity and resume

A resumed session writes a **new** `sessionId` file that replays the previous
launch's records verbatim. Verified on one pair: files A (1,594 unique records)
and B (463); 461 records appear in both with identical `uuid` **and** identical
`timestamp`, and B's own new records span only its final 15 seconds of new work.
Counting both files independently would double-count 461 records of agent time.
Mitigation: attribute each `uuid` to the launch whose file first contains it.

No transcript in a 400-file sample contains more than one `version` value, and
only 1 of 200 sampled files contains a gap larger than 30 minutes between
consecutive records — consistent with one transcript file per process launch.
Per the #3 rule, invocation boundaries are never inferred from inactivity gaps.

### Working-directory changes

Distinct `cwd` values per `cli` session: 1 → 20 sessions, 2 → 20, 3 → 7, 5 → 1.
28 of 48 sessions (58%) change directory at least once, matching this
repository's own worktree-based flow. Per-record `cwd` makes exact
timestamped attribution possible.

### Sub-agents

63 session directories contain a `subagents/` directory, 216 sub-agent
transcripts in total. Sub-agent records carry `agentId`, `isSidechain: true`,
their own `timestamp`/`cwd`, and the parent's `sessionId`; the sibling
`meta.json` links to the parent's Task tool call through `toolUseId`. No
sub-agent records were found inline in main transcripts, so parent and
sub-agent activity never overlap in the same file and remain separately
measurable and additive.

### Active sessions

`~/.claude/sessions/<pid>.json` example fields: `pid`, `sessionId`, `cwd`,
`startedAt` (epoch ms), `procStart`, `version`, `kind` (`interactive` / `bg`),
`entrypoint`, `status` (`busy` / `idle`), `updatedAt`. Eight such files existed;
all eight PIDs were alive, with `updatedAt` values from minutes to a month old —
long-lived idle sessions are real, so a recency window alone would misclassify
them. `procStart` was verified to equal field 22 (`starttime`) of
`/proc/<pid>/stat`, which makes a PID-reuse guard possible on Linux.
