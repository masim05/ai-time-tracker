# Implementation plan — 016 bug: Codex human time

1. **Failing regression test first**
   - extend the Codex fixture builder in `codexReader.test.ts` with a
     `rollout_path` column and sanitized rollout JSONL files (no real content);
   - add a case where log rows span the whole thread but the rollout shows two
     short turns with idle gaps; assert the reader returns two short
     `agentSpans` and the two user-triggered `task_started` timestamps as
     `promptsMs` (fails on `main`).
2. **Rollout parsing in `CodexReader`**
   - select `rollout_path` when the column exists (older schemas stay
     compatible);
   - stream/parse the rollout per thread, reading only the R5 fields;
   - build spans from turn pairs (R1) and prompts (R2).
3. **Fallbacks and diagnostics (R3)**
   - missing column/path/file or no turns → existing log clustering;
   - no rollout prompts → `history.jsonl`;
   - content-free warnings for unreadable files and malformed lines.
4. **Keep start/end, classification, and names unchanged (R4)**.
5. **Docs**: update ADR-0002 Codex sections (R7).
6. **Verification**: `npm run typecheck`, `npm test`, `npm run build`, then the
   E2E scenarios; store sanitized evidence in `artifacts/`.

## Follow-up after owner review on PR #18 (R8)

7. **Failing tests first** (`codexReader.test.ts`, `CodexReader imported
   threads`): fixture builder writes `external_agent_session_imports.json`;
   cases for replay-only skip + counted warning, post-import turns only,
   the 60 s replay-tolerance boundary, missing `imported_at`, sub-agent of a
   skipped import, absent / malformed / unreadable imports file, and records
   without a thread id. Native thread assertions in each case.
8. **`CodexReader.readImports`** reads only `imported_thread_id` and
   `imported_at`; **`readImportedThread`** reuses `readRollout` with a cutoff
   (`imported_at * 1000 + 60 s`) and derives start/end from post-import spans,
   or skips the thread; one counted warning for skipped threads.
9. **Docs**: spec R8 + superseded decision, ADR-0002, README Codex
   limitations, test plan, E2E E4, developer verification.
