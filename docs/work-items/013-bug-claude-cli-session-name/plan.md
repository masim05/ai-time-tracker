# Implementation plan — 013 bug: `claude-cli` session name

1. Record contract (`claudeCliReader.ts`):
   - drop `sessionName` and `sessionNameSource` from `ClaudeTranscriptRecord`;
   - add the fields the verified shape needs: `subtype`, `content`.
2. Extraction:
   - replace `explicitClaudeName` with a parser for the rename record:
     `type === 'system'`, `subtype === 'local_command'`, `content` containing
     `<command-name>/rename</command-name>` with the value inside
     `<command-args>…</command-args>`;
   - trim the extracted value; unescape nothing else (the value is a plain
     session name);
   - keep `extractClaudeNameEvents` emitting `SessionNameEvent[]` in transcript
     order, so grouping and the resume/replay attribution stay untouched;
   - keep the existing empty/whitespace warning diagnostic, content-free.
3. Fixtures (`__fixtures__/claude/projects/-work-alpha/s1-*.jsonl`):
   - remove `sessionName` / `sessionNameSource` and the `type: "session.name"`
     records;
   - express the same naming timeline with real `system`/`local_command`
     `/rename` records, preserving the existing timestamps so the unrelated
     prompt, span, and resume assertions in the suite keep their meaning;
   - add negative fixture records: a non-rename local command, a `/rename` with
     an empty argument.
4. Tests:
   - `claudeCliReader.test.ts`: rename events extracted with correct timestamps
     and order (regression for the bug); other local commands ignored; empty
     rename argument produces a warning and no event; replayed rename records
     stay attributed to the launch that recorded them first.
5. Documentation:
   - update the README session-name notes only if the fix makes the current
     wording inaccurate.
6. Verification:
   - run the full local check set from `test-plan.md`;
   - capture live evidence: the reproduction command before and after the fix.
