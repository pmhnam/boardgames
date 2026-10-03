# Board Game Platform

An online platform for turn-based board games. The platform (auth, rooms, matches, realtime,
persistence, replay) is generic; each game is an isolated package that owns its own state,
rules, scoring and visibility.

- **API** — NestJS, Socket.IO, Drizzle ORM, PostgreSQL
- **Web** — React, Vite, React Router, TanStack Query, Zustand
- **Games** — pure TypeScript packages with no framework dependencies

## Getting started

Requires Node 22.12+ and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. Each browser tab is its own guest (the session lives in
`sessionStorage`), so two tabs can play each other: create a room in one, open the invite link
in the other.

With no `DATABASE_URL`, the API runs on embedded Postgres (PGlite) stored in
`apps/api/.data/pglite` — no Docker needed. To use a real PostgreSQL:

```bash
docker compose up -d
cp .env.example apps/api/.env   # then set DATABASE_URL
```

To be able to change game configs, also set `ADMIN_TOKEN` in `apps/api/.env`.

Migrations are applied on boot. After changing `apps/api/src/infrastructure/database/schema.ts`,
run `pnpm db:generate`.

## Commands

| Command          | What it does                                   |
| ---------------- | ---------------------------------------------- |
| `pnpm dev`       | API on :3000, web on :5173, packages in watch  |
| `pnpm test`      | Engine unit tests + API end-to-end tests       |
| `pnpm typecheck` | `tsc --noEmit` everywhere                      |
| `pnpm lint`      | ESLint, including the package dependency rules |
| `pnpm build`     | Production build of every package and app      |

## Layout

```text
apps/
  api/                 NestJS: auth, rooms, matches, realtime gateway, game registry
  web/                 React: lobby, room, match, replay, per-game renderers
packages/
  game-core/           Engine contract, seeded PRNG, test helpers
  game-harmonies/      Harmonies: hex boards, token stacking, animal cards
  game-demo/           Grid Claim: a tiny 5x5 game used to exercise the platform
  shared-types/        REST and WebSocket contracts shared by API and web
docs/
  architecture.md      How the pieces fit
  adding-a-game.md     The checklist for a new game
  adr/                 Decisions and their reasons
```

## Games

**Harmonies** (2–4 players) implements the published game's rules: take three tokens from the
central board, stack them into trees, mountains, fields, buildings and water on your own hex
board, and place animals on matching habitats. Two caveats:

- The default 24 animal cards are an original placeholder set, not the published cards. They
  are part of the game's config, so they can be replaced without touching code (see below).
- Harmonies is a commercial game. Its name, artwork and card set belong to its publisher; get a
  licence before shipping this beyond private use.

**Grid Claim** (2 players) is an original, deliberately small game kept as a second
implementation of the engine contract.

## Game configuration

Each game's tunable data lives in the database, not in code. For Harmonies that is the board
shape, the animal cards and the number of tokens of each colour. The first boot seeds version 1
from the engine's defaults; after that the database is the source of truth.

```bash
curl localhost:3000/api/games/harmonies/config
```

```bash
curl -X PUT localhost:3000/api/games/harmonies/config \
  -H 'content-type: application/json' \
  -H 'x-admin-token: <ADMIN_TOKEN>' \
  -d '{ "config": { "boardCells": [], "tokenCounts": {}, "cards": [] }, "note": "why" }'
```

Send a complete config: the game's engine validates it as a whole and rejects anything it could
not play, with the reason. Publishing adds a new version; it never edits an old one.

- New matches use the newest version.
- Matches in progress keep the config they started with.
- Matches that finished under an older version can no longer be replayed. Their result and move
  list are still available.

## What is not built yet

An admin UI for game configs, chat, bots, matchmaking, rankings, timers, refresh tokens, abandoning a match in progress, and
Redis (only needed once there is more than one API instance). See `docs/architecture.md`.
