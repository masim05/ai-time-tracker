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
