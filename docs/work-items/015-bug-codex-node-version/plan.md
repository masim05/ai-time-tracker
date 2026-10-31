# Implementation plan — 015 bug: Codex missing (Node version)

1. Add `.nvmrc` at the repository root containing `24`.
2. Update `.github/workflows/ci.yml` `Application checks` to use
   `node-version-file: .nvmrc` instead of `node-version: lts/*`; keep npm cache.
3. Update README "Install and build" with `nvm use` before `npm install`, and a
   note that switching Node versions requires `npm rebuild` (native
   `better-sqlite3`).
4. Record reproduction and verification evidence in `artifacts/`
   (content-free: counts, versions, diagnostics reasons only).
5. Run all README validation commands plus `npm run typecheck`, `npm test`,
   `npm run build` under the pinned Node version before push.
