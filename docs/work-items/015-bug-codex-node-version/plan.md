# Implementation plan — 015 bug: Codex missing (Node version)

1. Add `.nvmrc` at the repository root containing `24`.
2. Record reproduction and verification evidence in `artifacts/`
   (content-free: counts, versions, diagnostics reasons only).
3. Run all README validation commands plus `npm run typecheck`, `npm test`,
   `npm run build` under the pinned Node version before push.
