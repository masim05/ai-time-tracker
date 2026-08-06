# Implementation plan — 014 bug: Codex session name

1. **Record completed provider discovery**
   - document that supported `state_5.sqlite` `threads` rows expose latest-only
     `name` (explicit) and `title` (provider-generated) fields and no timestamped
     naming history;
   - record only schema/field names, counts, versions where available, and
     conclusions in `artifacts/`; never record real values or conversation text;
   - update the storage ADR because `title` extends its documented name source.
2. **Write the failing regression cases**
   - extend the existing sanitized Codex SQLite fixture schema with verified
     naming fields/tables;
   - demonstrate the current failure for generated persisted titles and any
     other verified source currently ignored;
   - cover both CLI and App classification.
3. **Implement focused Codex extraction**
   - extend the infrastructure query/parser to read verified explicit and
     generated provider-owned naming metadata in one bounded pass;
   - normalize values and apply explicit-over-generated precedence;
   - produce one launch-start `SessionNameEvent` with
     `hasApproximateNameHistory` and the existing latest-only warning;
   - attach events only to the launch root and keep sub-agent inheritance in the
     existing reporter pipeline.
4. **Handle edge and error states**
   - empty/whitespace explicit name with valid generated-title fallback;
   - no eligible values;
   - both fields populated, with explicit-name precedence;
   - malformed/unsupported naming metadata with content-free diagnostics;
   - schema compatibility when an optional naming field/source is unavailable.
5. **Verify downstream behavior without redesign**
   - use existing grouping, projection, and formatter coverage to confirm
     temporal segmentation and `-`/`null`/empty rendering;
   - add focused downstream regression assertions only if the reader evidence
     exposes a previously untested boundary; do not weaken unrelated tests.
6. **Document verified behavior**
   - update README naming behavior and ADR-0002 only where live discovery makes
     current wording incomplete or inaccurate;
   - record root cause, storage compatibility, fallback limitations, and
     sanitized verification in the pull request.
7. **Validation and evidence**
   - run the focused and complete checks from `test-plan.md`;
   - run the E2E scenarios read-only on development-server Codex CLI/App data;
   - save only content-safe command/results summaries in `artifacts/`.

## Handoff boundaries

- Stop and return to the Manager if implementation uncovers a storage shape that
  contradicts the verified naming-source or precedence contract in `spec.md` in
  a way that changes user-visible scope.
- Do not infer a title from ordinary session messages as a workaround.
- Do not modify provider data, add network calls, or change non-Codex readers.
