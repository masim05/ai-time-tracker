# Implementation plan — 013 bug: `claude-cli` session name

Steps 1–6 were planned before implementation. Step 7 was added after AI Reviewer
found the missed `custom-title` source during review of PR #12 (clarification
record #4 in `spec.md`).

1. Record contract (`claudeCliReader.ts`):
   - drop `sessionName` and `sessionNameSource` from `ClaudeTranscriptRecord`;
   - add the fields the verified shapes need: `subtype`, `content`,
     `customTitle`.
2. Extraction from rename history:
   - replace `explicitClaudeName` with a parser for the rename record:
     `type === 'system'`, `subtype === 'local_command'`, `content` whose
     **start** is `<command-name>/rename</command-name>`, taking the value from
     the `<command-args>` belonging to that same command block;
   - skip sidechain and meta records, as `isHumanPrompt` does;
   - normalise the extracted value: collapse newlines and tabs to single spaces,
     then trim. No length cap — truncation is a formatter-level concern shared
     with the other providers;
   - emit `SessionNameEvent[]` in timestamp order, so grouping and the
     resume/replay attribution stay untouched;
   - keep a content-free warning for a rename that records no name.
3. Fixtures (`__fixtures__/claude/`):
   - remove `sessionName` / `sessionNameSource` and the `type: "session.name"`
     records;
   - express the same naming timeline with real `system`/`local_command`
     `/rename` records, preserving the existing timestamps so the unrelated
     prompt, span, and resume assertions in the suite keep their meaning;
   - add negative records: a non-rename local command, a non-rename command
     quoting a rename block, the `<local-command-stdout>` record a rename writes
     after itself, sidechain and meta records, a non-string `content`, and
     renames with an empty argument, a whitespace-only argument, and no
     `<command-args>` tag.
4. Tests: see `test-plan.md`.
5. Documentation: update the README only if the fix makes existing wording
   inaccurate. (It did not — the README already contracts for latest-name-only
   metadata with a warning.)
6. Verification:
   - run the full local check set from `test-plan.md`;
   - capture live evidence: the reproduction command before and after the fix.
7. `custom-title` fallback (added in iteration 2):
   - read the launch's **last** `type: "custom-title"` record and apply its
     `customTitle` launch-wide as a single event at launch start;
   - apply it **only** when the launch recorded no `/rename` of its own, so
     rename history always wins and the two sources are never mixed;
   - set `hasApproximateNameHistory` on the launch root and emit the same
     latest-only warning the Copilot and Codex readers emit;
   - ignore an empty, whitespace-only, or non-string `customTitle`;
   - this is what gives a **resumed** launch its name: the `/rename` record it
     replays belongs to the launch that recorded it first, while `custom-title`
     is re-emitted for the resumed launch itself.
