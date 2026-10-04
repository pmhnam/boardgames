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
  game-splendor/       Splendor: gem tokens, development cards, nobles
  game-werewolf/       Ma Sói (Werewolf): secret roles, nights, votes
  game-demo/           Grid Claim: a tiny 5x5 game used to exercise the platform
  shared-types/        REST and WebSocket contracts shared by API and web
deploy/                Dockerfile, production compose, nginx config, server script
docs/
  architecture.md      How the pieces fit
  adding-a-game.md     The checklist for a new game
  deployment.md        How main gets to the server
  adr/                 Decisions and their reasons
```

## Games

**Harmonies** (2–4 players) implements the published game's rules: take three tokens from the
central board, stack them into trees, mountains, fields, buildings and water on your own hex
board, and place animals on matching habitats. Two caveats:

- The default deck is the 32 animal cards of the base set (habitats and scores). Their
  Vietnamese names were chosen for this project; the source data has none. Cards are part of
  the game's config, so they can be changed without touching code (see below).
- A habitat only counts when every cell is in its exact place around the animal, at its exact
  height, in one of six rotations. Mirror images do not count.
- There are two maps, like the two sides of the printed board, and the room's host picks one
  when creating the room. Each map carries its own water scoring: side A (23 cells) scores the
  longest river, side B (25 cells) scores 5 points per island.
- A player may hold at most three unfinished animal cards; a card stops counting once all its
  animals are placed.
- Harmonies is a commercial game. Its name, artwork and card set belong to its publisher; get a
  licence before shipping this beyond private use.

**Splendor** (2–4 players) implements the base game: take three different gems or two of one
colour, reserve a card for a gold, or buy a card with gems, gold and the bonuses of the cards
already bought; nobles visit whoever has the bonuses they ask for. The first to 15 points ends
the game once the round is complete.

- The default config is the 90 development cards and 10 nobles of the base set. The room's host
  picks the winning score from the ones the config offers (10, 15 or 20).
- Three different gems means three, unless the bank has fewer colours left. Payment is worked
  out for the player: gems first, gold only for what is still short.
- A card reserved from the top of a deck is hidden from everyone but its owner, in play and in
  the replay. It is the one game here where players see different things.
- If nobody can take, reserve or buy, players pass; a whole round of passes ends the game.
- Splendor is a commercial game. Its name and card set belong to its publisher; get a licence
  before shipping this beyond private use. No artwork from the game is used.

**Ma Sói** (Werewolf, 5–16 players) is played with the app as the moderator and the talking
done out loud, around a table or on a call. Ten roles: villager, werewolf, alpha werewolf, seer,
bodyguard, witch, hunter, cupid, elder and idiot.

- The room's host picks the cast: the config's suggestion for however many are seated, or a
  count for each special role, with villagers taking the seats that are left. A cast that does
  not fit the table (too many roles, a pack of half the players) is refused when the host starts.
- At night every living player sends one action, the ones with nothing to do included, so
  that tapping a phone gives no role away. The witch is woken after the pack has chosen.
- By day the vote opens once more than half of the living say they are done talking. Votes
  stay secret until all are in; a tie executes nobody.
- A role leaves the server only for its owner, a werewolf's packmates, or once it is revealed
  to the table. Anyone watching, and the replay, see no roles until the match is over.
- There are no timers: a phase ends when everyone it waits for has acted.

**Grid Claim** (2 players) is an original, deliberately small game kept as a second
implementation of the engine contract.

## Computer players

A room's host can fill empty seats with computer players, at three levels. In Harmonies:

- **Dễ** plays any legal move.
- **Thường** places each token where it looks best right now.
- **Khó** plans the whole hand before placing, stacks rather than spreads when the board is
  about to fill up, and puts each animal where it blocks the least.

In Splendor, **Dễ** plays a random legal move but buys whenever it can, **Thường** makes the
move that leaves its own position best, and **Khó** plans three turns ahead and takes or
reserves the card an opponent is about to buy.

In Ma Sói a bot cannot talk, so it is a seat-filler: **Dễ** plays any legal move, **Thường**
spares its pack and its lover and votes for a werewolf its seer has found, and **Khó** also
follows where the last vote leaned.

Bots are algorithmic, not an LLM: they run inside the API, cost nothing and answer at once
(`BOT_ACTION_DELAY_MS`, 700 by default, paces them so people can follow). A bot sees only what
a person in its seat would see, and its moves go through the same checks as anyone's.

## Game configuration

Each game's tunable data lives in the database, not in code. For Harmonies that is the list of
maps (each with its shape and water scoring), the animal cards and the number of tokens of each
colour. The first boot seeds version 1
from the engine's defaults; after that the database is the source of truth.

```bash
curl localhost:3000/api/games/harmonies/config
```

```bash
curl -X PUT localhost:3000/api/games/harmonies/config \
  -H 'content-type: application/json' \
  -H 'x-admin-token: <ADMIN_TOKEN>' \
  -d '{ "config": { "maps": [], "tokenCounts": {}, "cards": [] }, "note": "why" }'
```

Send a complete config: the game's engine validates it as a whole and rejects anything it could
not play, with the reason. Publishing adds a new version; it never edits an old one.

- New matches use the newest version.
- Matches in progress keep the config they started with.
- Matches that finished under an older version can no longer be replayed. Their result and move
  list are still available.

## What is not built yet

An admin UI for game configs, chat, an LLM opponent, matchmaking, rankings, timers, refresh tokens, abandoning a match in progress, and
Redis (only needed once there is more than one API instance). See `docs/architecture.md`.
