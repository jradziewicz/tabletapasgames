# Project instructions

@AGENTS.md

## TableTapas fork notes

This is the TableTapas Games fork of `justinkwaugh/tabletop`, live at
https://play.tabletapasgames.com (GCP project `stellar-ventures-509504`,
Firestore `(default)` database). Everything below is fork-specific and sits
on top of the upstream guidance in `AGENTS.md`.

### Branches and worktrees

- `main` (this checkout, `~/Documents/tabletop`) is what is live. Keep it
  deployable at all times; Stellar Ventures and website fixes land here.
- `rocky-ventures` is checked out as a git worktree at
  `~/Documents/tabletop-rocky`. Rocky Ventures (`games/rocky-ventures`,
  `games/rocky-ventures-ui`) is developed there, local-only, until it is
  ready. Merge `main` into it periodically; never deploy from it and never
  add it to `config/config-games/src/site-manifest.json` until launch.
- Each worktree has its own `node_modules`; run `pnpm install` in each on
  the Mac.

### Deploying (the user does this, never an agent)

All deploys go through `pnpm run deploy:tui` from the repo root, run by
Justin in his own Terminal. Agents must not run `gcloud run deploy`, upload
bundles to GCS, or write `site-manifest.json`; read-only checks
(`gcloud run services describe`, `gcloud storage ls/cat`) are fine.

TUI targets and keys: arrow keys select a target; `d` deploys, `y` confirms
(for Backend, `y` also shifts traffic). Backend asks which service: `b`
backend, `t` tasks, `a` both. Version bump: `v`, then `l` (logic) or `u`
(ui), then `1`/`2`/`3` for major/minor/patch. `i` invalidates the manifest
cache.

Which target a change needs:

- `apps/frontend`, `libs/frontend-components`, and anything under
  `libs/common` that the client validates → **Frontend**.
- `apps/backend`, `libs/backend-services`, `libs/email` → **Backend**
  (`backend` + `tasks` Cloud Run services).
- `games/<slug>` or `games/<slug>-ui` (including the game description in
  `src/definition/gameDefinition.ts`) → that game's **Game UI** target.
- A `libs/common` change usually needs both Frontend and Backend.
- A new Firestore query needing a composite index → add it to
  `firebase/firestore.indexes.json` and run
  `cd firebase && npx firebase-tools deploy --only firestore:indexes --project stellar-ventures-509504`
  (`.firebaserc` points at the emulator project, so `--project` is required).
  Deploy indexes before the code that uses them.

### Working from an agent sandbox (Cowork / Claude Code on the Mac)

- The sandbox mounts the same folder as the Mac, including `node_modules`.
  **Never run `pnpm install` from the sandbox**: it installs Linux native
  binaries (rollup, `@typescript/native-preview`) and breaks the Mac build
  with `Cannot find module @rollup/rollup-darwin-arm64`. Fix on the Mac:
  `rm -rf node_modules && pnpm install`.
- For that reason, type-check from the sandbox with
  `node_modules/.bin/tsc --noEmit -p tsconfig.json` inside each package
  (`libs/common`, `libs/backend-services`, `apps/backend`,
  `libs/frontend-components`, `apps/frontend`, `games/<slug>`,
  `games/<slug>-ui`) instead of `pnpm run check`, `svelte-check`, or
  `vitest`, which need those binaries.
- Known pre-existing `tsc` noise, safe to ignore: `Cannot find module
  './$types.js'` / implicit-any in `+page.ts` files (until `svelte-kit sync`
  runs), `gsap` typings under `libs/frontend-components`, and the
  `TabletopApiPublic` harness mocks in `libs/frontend-components` missing
  newer `TabletopApi` methods.
- The sandbox cannot delete files. A stale `.git/index.lock` must be moved
  aside with `mv`, not `rm`.

### Conventions learned the hard way

- API responses that return stored games (lists, pages) must use the plain
  `Game` schema, not `GameWithoutState` (`additionalProperties: false`):
  Firestore documents carry storage-only fields (`actionChunkSize`,
  `userIds`) and the client's `Value.Assert` rejects the whole response.
  `GameHistoryPage` and `AdminGamesPage` both do this.
- Firestore `orderBy` on a field silently drops documents missing that
  field; `updatedAt` is set on every game at creation, `finishedAt` only on
  finished games.
- Brand purple is `#7165ad` (hover `#5b4f95`), sampled from the logo.
- Admins open any game in host view via `/game/<id>?admin=1`; the admin
  list lives at `/admin/games` and only appears in the avatar menu for the
  Admin role.
