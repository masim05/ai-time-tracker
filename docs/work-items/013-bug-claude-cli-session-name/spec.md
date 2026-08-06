# 013 — bug: report shows no session name for `claude-cli` sessions

Issue: [masim05/ai-time-tracker#11](https://github.com/masim05/ai-time-tracker/issues/11)

## Task type

`bug`

## Actual behavior

Every `claude-cli` row renders `name` as unset, even when the session has an
explicit name:

```text
$ npm run cli -- report -f 20260803

agent        path                  name       human  agent-time  start             duration  subagents
copilot-cli  email-proxy           JHAIC-751     2m         31m  2026-08-04 07:33     3h44m  3
claude-cli   jobhire-smtp          -            32m      13h49m  2026-08-05 10:56    14h22m  0
```

The `claude-cli jobhire-smtp` launch was named `JHAIC-755` by the developer
(screenshot in the issue comment).

## Expected behavior

- A `claude-cli` launch with a persisted explicit name reports that name for the
  time segment in which it was active, in `table`, `json`, and `csv`.
- Renaming during a launch splits the launch into temporally bounded rows, using
  the existing splitting rules from work item 012.
- A launch with no persisted name keeps the unset contract: `-` (table), `null`
  (JSON), empty field (CSV).

## Reproduction

1. Run a Claude Code CLI session and set a name with `/rename <name>`.
2. Run `npm run cli -- report -f <that day>`.
3. The `claude-cli` row for that session shows `-` in the `name` column.

## Root cause

Work item 012 added Claude name extraction against **assumed** transcript
metadata: `extractClaudeNameEvents` /
`explicitClaudeName`
(`modules/session-reader/src/infrastructure/claudeCliReader.ts`) accept a
`sessionName` field paired with a `sessionNameSource` of `user`, `rename`, or
`launch`, and the fixtures in
`modules/session-reader/src/infrastructure/__fixtures__/claude/` were written to
match that shape (including a `type: "session.name"` record).

Claude Code does not persist any of that. `explicitClaudeName` therefore always
returns `undefined`, `sessionNameEvents` is always empty, and
`groupingService` produces a single nameless segment for every Claude launch.

## Provider discovery summary

Verified on Claude Code `2.1.223`, Linux, against live local data.

- **Transcript** (`~/.claude/projects/<slug>/<sessionId>.jsonl`): a rename is
  persisted as a timestamped record

  ```json
  {"type":"system","subtype":"local_command","level":"info",
   "content":"<command-name>/rename</command-name>\n            <command-message>rename</command-message>\n            <command-args>JHAIC-755</command-args>",
   "timestamp":"2026-08-05T10:56:27.989Z","sessionId":"892278f6-…","cwd":"…","isSidechain":false}
  ```

  This is the only **timestamped** source and the only one that supports full
  rename history. No `sessionName` / `sessionNameSource` field occurs anywhere in
  the transcript corpus (2980 transcripts scanned).
- **Transcript `custom-title` record** (same files): the launch's latest explicit
  name, repeated many times through the transcript, first written as line 1

  ```json
  {"type":"custom-title","customTitle":"JHAIDO-611","sessionId":"87be0c78-…"}
  ```

  It carries **no `timestamp` and no `uuid`**, so it holds no rename history and
  is invisible to the replay attribution that uses record uuids. Present in 4 of
  2983 transcripts, exactly the ones renamed with `/rename`. This is the only
  name a **resumed** launch owns: the `/rename` record it replays belongs to the
  launch that recorded it first, while `custom-title` is re-emitted for the
  resumed launch itself. Discovered by AI Reviewer during review of PR #12, after
  the initial discovery missed it (see clarification #4).
- **Transcript `agent-name` record** (`{"type":"agent-name","agentName":"…"}`):
  same untimestamped shape, but it carries auto-derived titles such as
  `"Create GitHub issue for Claude support"` in 33 transcripts. It is **not** an
  explicit developer-set name and is deliberately not read.
- **Live-launch registry** (`~/.claude/sessions/<pid>.json`): holds `name` and an
  optional `nameSource: "derived"` marker for auto-generated names, but only for
  recent launches (6 files against 2980 transcripts) and without any timestamp.
  Not usable as the source for a historical report.
- A rename record is replayed into the transcript of a resumed launch, exactly
  like every other record, so it must follow the existing
  first-launch-claims-the-record attribution.

## Clarification record

| # | Label | Question | Decision |
| --- | --- | --- | --- |
| 1 | `[TECH]` | Which source should the fix use: transcript `/rename` records, transcript plus latest-only registry fallback, or registry only? | Transcript `/rename` records only. Durable, timestamped, preserves rename history; the registry is pruned and untimestamped. |
| 2 | `[REQ]` | Should auto-generated names (registry `nameSource: "derived"`, background-job auto-titles) be reported? | Include all names found in the chosen source; no source-marker filtering. With transcript-only extraction every name comes from an explicit developer `/rename`. |
| 3 | `[TECH]` | Keep the unreachable `sessionName` / `sessionNameSource` path as a forward-compatible extra shape, or remove it? | Remove it, together with its speculative fixtures, and replace it with the verified extraction. |
| 4 | `[TECH]` | Provider discovery missed the transcript `custom-title` record, so decision #1 was taken between `/rename` and the pid registry only. AI Reviewer found it in review of PR #12: a resumed launch still reported `-`, because its `/rename` record is a replay owned by the launch that recorded it first — live, the 8-second launch `676688c1` showed `JHAIDO-611` while the resumed 16h22m launch `87be0c78` showed `-`. Add `custom-title` as a fallback, or record the omission and defer? | Add it as a latest-only fallback. It is a transcript record, so this stays within decision #1 (transcript over registry) and decision #2 (accept every name in the chosen source). Rules: use it **only** when the launch recorded no `/rename` of its own; take the **last** `custom-title` in the transcript; apply it launch-wide from launch start with the same latest-only warning and `hasApproximateNameHistory` flag the Copilot and Codex readers already use. Never mix the two sources. |

## Scope

In scope:

- `claude-cli` explicit-name extraction from `/rename` transcript records;
- the `custom-title` latest-only fallback for launches that recorded no
  `/rename` of their own, with the existing latest-only warning and
  `hasApproximateNameHistory` contract;
- removal of the unreachable `sessionName` / `sessionNameSource` path and its
  fixture records;
- Claude fixtures and reader tests rewritten against the verified record shape;
- README wording where it describes Claude session-name behavior, if it becomes
  inaccurate.

Out of scope:

- Copilot CLI and Codex name extraction and their fallback contract;
- reading the `~/.claude/sessions/<pid>.json` registry for names;
- reading `agent-name` records, which hold auto-derived titles rather than
  explicit developer-set names;
- the `name` column definition, ordering, default column set, and rendering
  contract (owned by work item 012);
- grouping/temporal-splitting rules;
- any change to time accounting (`human`, `agent-time`, `duration`,
  `subagents`);
- inferring names from prompt or response text.

## Constraints

- Bugfix boundaries from `docs/engineering/change-policy.md`: the fix stays
  inside the Claude reader; existing tests must not be weakened; a regression
  test that fails before the fix is required.
- Diagnostics stay content-free: no transcript `content` value, prompt, or
  response text may reach a `Diagnostic`.
- All access remains read-only and offline.
- A malformed, empty, or argument-less rename record must degrade to "no name"
  with a warning diagnostic, never throw. A record whose `content` is not a
  string is the one exception: it is not identifiable as a rename at all — every
  `local_command` record Claude Code writes has string `content` — so it is
  skipped silently, as is a `custom-title` record whose `customTitle` is not a
  string.

## Accepted consequences

- A `/rename` issued a few seconds after launch start produces a short unnamed
  first row followed by the named row. That is the temporal-splitting contract
  defined in work item 012 and is intentionally not changed here.
- A launch named only through `custom-title` reports that name for its whole
  span with a latest-only warning, because the record carries no timestamp. A
  rename boundary inside such a launch cannot be recovered; the launch that
  recorded the `/rename` keeps the exact history.
- Sessions named before this record shape existed, or named by a mechanism that
  leaves no transcript record, remain unnamed.
- Auto-derived `agent-name` titles are never reported as session names.
