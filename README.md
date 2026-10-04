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
  game-avalon/         Avalon: hidden roles, team votes, quests, the assassination
  game-harmonies/      Harmonies: hex boards, token stacking, animal cards
  game-splendor/       Splendor: gem tokens, development cards, nobles
  game-catan/          CATAN: hex island, dice, robber, trading, development cards
  game-werewolf/       Ma Sói (Werewolf): secret roles, nights, votes
  game-bang/           BANG!: secret roles, hidden hands, cards that ask for an answer
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

**Avalon** (5–10 players) implements The Resistance: Avalon: a leader proposes a team, everyone
votes on it, the team plays Success or Fail in secret, and the side with three quests takes the
game, unless the Assassin then names Merlin.

- Every player is dealt a role only they can see. Merlin and the Assassin are always in play; the
  room's host may add Percival, Morgana, Mordred and Oberon, and the Lady of the Lake. Roles take
  seats on their side, so some choices need a larger table: the room says so, and a match that
  cannot seat them does not start.
- Team sizes, the number of evil players, the quests that need two Fails and the five-rejection
  limit follow the published tables for each player count. They are part of the game's config.
- Votes and quest cards are cast by everyone at once. A vote is shown once all are in; of the
  quest cards only the number of Fails is ever announced. Roles, cards and what the Lady showed
  are revealed to all when the game ends; the replay shows what a watcher saw.
- There are no computer players for Avalon, and no chat: the talking happens wherever the group
  already talks.
- Avalon is a commercial game. Its name belongs to its publisher; get a licence before shipping
  this beyond private use. No artwork from the game is used.

**CATAN** (3–4 players) implements the base game as the 6th edition rulebook gives it: settle
the corners of a hex island and collect what the dice produce, build roads, settlements and
cities, buy development cards, and trade with the supply or with the other players. The first
to 10 points on their own turn wins.

- The room's host picks one of the rulebook's two setups. The variable setup places the hexes
  at random, lays the number discs in their letter order from a corner of the island inwards,
  skipping the desert, and shuffles the six pieces of the sea frame, so the ports move too. The
  fixed setup is the rulebook's first game: its island, its ports, and every player's two
  settlements and roads already on the board, so play starts with the first roll.
- A 7 makes every hand of more than seven cards discard half, all at the same time. A trade
  offer is answered out of turn in the same way, and the player who made it picks whom to trade
  with or withdraws it.
  The rulebook also lets the others make counteroffers; here they can only accept or decline.
- Hands and development cards are hidden from the other players, and a Victory Point card
  stays hidden until the game is over. Dice and robbery are drawn from the match's seed as they
  happen, so a replay rolls the same dice.
- The island, the frame and its ports, the number discs, the fixed setup, the decks, the costs,
  the pieces and the thresholds for Longest Route, Largest Army and discarding are config.
- Names follow the 6th edition: wheat, ports, the Invention card and Longest Route.
- CATAN is a commercial game. Its name and rules belong to its publisher; get a licence before
  shipping this beyond private use. No artwork from the game is used.

**BANG!** (4–7 players) is the base game: sheriff, deputies, outlaws and a renegade, the 80
playing cards and the 16 characters. No expansions, and no three-player variant.

- One player is asked at a time. A card that needs an answer (a BANG!, a duel, the Indians, a
  general store) puts the match on hold for whoever owes it, round the table in turn order.
- What has only one sensible answer is done without asking: a barrel is tried, a beer is drunk
  by a player who would otherwise be eliminated, the two cards of a turn are drawn. Characters
  with a real choice (Jesse Jones, Pedro Ramirez, Kit Carlson, Sid Ketchum) are asked.
- A role leaves the server only for its owner, for the sheriff, or once its player is
  eliminated; a hand only for its owner, as a count for everyone else. A card taken from a
  hand is named to the two players involved and to nobody else.
- BANG! is a commercial game. Its name, cards and characters belong to its publisher; get a
  licence before shipping this beyond private use. No artwork from the game is used.

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

In CATAN, **Dễ** plays a random legal move but builds whenever it can and trades with the
supply when it cannot, **Thường** settles where the dice roll most and saves for the nearest
thing it can build, and **Khó** also counts ports and the resources it lacks, trades with the
supply towards its plan, and robs and refuses to trade with whoever is nearest to winning. All
three discard and answer trade offers out of turn; none makes offers of its own.

In BANG!, **Dễ** plays any legal card, **Thường** plays its role against whoever has gone after
the sheriff, and **Khó** also counts the roles still hidden to tell how likely a stranger is
to be on its side, and goes for whoever is closest to elimination.

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
