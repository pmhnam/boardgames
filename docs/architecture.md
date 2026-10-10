# Architecture

A modular monolith: React web → NestJS API → PostgreSQL. The one boundary that matters:

- **Platform** — how people create, join, synchronise, persist, reconnect to and replay games.
- **Game engine** — which moves are legal and how they transform a game's state.

## Dependency rules

```text
web  → shared-types, game packages (types and view shapes only)
api  → shared-types, game-core, game packages
game-X → game-core
```

Game packages must not import NestJS, React, Socket.IO, the database, Node built-ins, or each
other. `eslint.config.mjs` enforces this, and also bans `Math.random` and `Date.now` there. They
compile without Node or DOM type definitions, so a stray dependency fails the build.

## The engine contract

`packages/game-core/src/contracts/engine.ts`. An engine is pure: the same seed and the same
actions always give the same state.

| Method               | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `defaultConfig`      | The config a fresh installation is seeded with.           |
| `parseConfig`        | Validate a config from the database or an admin request.  |
| `parseSettings`      | Validate what a room's host chose (e.g. which map).       |
| `createInitialState` | Setup from players, seed, config and settings.            |
| `parseAction`        | Shape-check an untrusted payload; copy only known fields. |
| `validateAction`     | Is this move legal? Returns a stable rule code if not.    |
| `applyAction`        | Returns a new state. Never mutates.                       |
| `getGameStatus`      | `playing` or `finished`.                                  |
| `getResult`          | Winners and scores, once finished.                        |
| `getPublicView`      | What a given player or spectator may see.                 |

Additions to the original specification: `defaultConfig`, `parseConfig` and `parseSettings`
(see Game configuration below), `parseAction` (so every action has runtime
validation without the platform knowing its shape) and `getResult` (so the platform can store an
outcome without reading game state).

## How an action is processed

`apps/api/src/modules/matches/game-action.service.ts` is the only path that mutates a match.

1. The gateway authenticates the socket and checks the payload's shape.
2. Load the match; map the authenticated user to a player (else `FORBIDDEN`).
3. If this `requestId` was already applied, report success and stop (idempotency).
4. Compare `expectedVersion` with the stored version (else `GAME_VERSION_CONFLICT`).
5. `engine.parseAction`, `engine.validateAction`, `engine.applyAction`.
6. In one transaction: insert the action, then
   `UPDATE matches … WHERE state_version = expected`. Zero rows updated means another writer got
   there first, and the transaction rolls back.
7. Emit `match.state-changed`; the gateway sends each player their own view.

The client only ever sends intent. Anything else in the payload is dropped by `parseAction`.

The same service has one other way to change a match: `abandon`, used by an administrator to end
a match in progress with no winner. It takes the same row lock as an action commit, sets the
status to `abandoned` and adds nothing to the action log, so the sequence still equals the state
version and what was played can be replayed. It never calls the engine, which is what lets it
end a match saved by rules the server no longer runs. It emits `match.finished`, the event that
reopens the room and tells the table (`game.finished`, with the status).

## Persistence

Current state snapshot plus an append-only action log (not event sourcing).

- `matches.state` is `jsonb`, opaque to the platform. `state_version` increases by one per action.
- `match_actions` has unique `(match_id, sequence)` and `(match_id, request_id)`.
- Replay rebuilds every state from `random_seed` and the action log, and refuses to run if the
  engine version has changed since the match was played.

## Game configuration

A game's tunable data (for Harmonies: board shape, animal cards, token counts) is stored in
`game_configs`, one `jsonb` document per version:

| Column       | Meaning                                               |
| ------------ | ----------------------------------------------------- |
| `game_type`  | Which game.                                           |
| `version`    | 1, 2, 3… per game. Primary key with `game_type`.      |
| `config`     | The whole config. Shaped and validated by the engine. |
| `note`       | Why it changed.                                       |
| `created_at` |                                                       |

The table is append-only: publishing a config inserts `version + 1`, and the primary key makes
two simultaneous publishes conflict instead of overwriting each other. The current config is
the row with the highest version.

- **Boot.** A registered game with no row gets version 1 from `engine.defaultConfig`.
- **Publishing.** `POST /admin/games/:gameType/configs`, administrators only. The platform
  passes the document to `engine.parseConfig` and stores the cleaned result with its author; it
  never looks inside. The request names the version the edit started from, and is refused if a
  newer one exists. Restoring an old version publishes its document again as the newest.
- **Starting a match.** The current config is re-validated, passed to `createInitialState`, and
  its version recorded in `matches.config_version`. An engine that needs the config after setup
  copies it into its state, as Harmonies does, so a match in progress is unaffected by later
  changes.
- **Replay.** Replay re-runs setup with the current config, so it is refused
  (`REPLAY_UNAVAILABLE`) for a match whose `config_version` is not the current one.

### Room settings

Config is what an operator sets for the whole game; settings are what a host picks for one
room, from the options the config offers (for Harmonies, which map). `POST /rooms` hands the
host's choice to `engine.parseSettings(raw, config)` and stores the cleaned result on the room.
When a match starts it is validated again against the config then in force, passed to
`createInitialState`, and saved on the match so a replay sets up the same way. Sending nothing
always yields the game's defaults.

On the web, a game opts in by registering a `SettingsForm` (and `describeSettings`) next to its
renderer in `apps/web/src/games/registry.ts`; the lobby and room pages stay game-agnostic.

Config and rules are versioned separately. `config_version` changes when an operator publishes
data; `engine_version` changes when the code changes what a state means. A match saved by a
different engine version is refused outright (`MATCH_OUTDATED`).

## Computer players

A game opts in by exporting a `bot` next to its engine: a `BotStrategy` with one pure function,
`chooseAction({ view, playerId, level, random })`. Like engines, strategies live in the game
package and import nothing from the platform.

- **A bot is a player.** Adding one creates a user row (`is_bot`) and a room member with a
  `bot_level`; from there rooms, matches, history and replay treat it like anyone.
- **It sees a view, not the state.** `BotRunnerService` hands the strategy exactly what
  `getPublicView` returns for that seat, so a bot knows nothing a person there would not.
- **It acts through the same pipeline.** The chosen action goes to `GameActionService.execute`
  under the bot's user id: same turn, version and rule checks, same action log.
- **It is event-driven.** The runner wakes on `match.started` and `match.state-changed`, plays
  one action if a bot is to move, and is woken again by the event its own action causes. One
  loop runs per match; the events' senders never wait for it.
- **It is reproducible.** The random source is seeded from the match seed and state version.
- **It cannot stall a match.** A strategy that throws or picks an illegal move falls back to a
  legal one; on boot the runner resumes every match that was waiting on a bot.

The hard level's search runs on the event loop (tens of milliseconds per action). Move it to a
worker thread before running many bot matches at once.

## Realtime

One Socket.IO connection per signed-in user, authenticated in the handshake.

| Client → server | Server → client                                |
| --------------- | ---------------------------------------------- |
| `room.join`     | `room.updated`, `game.started`                 |
| `room.leave`    |                                                |
| `game.sync`     | `game.state`, `game.finished`                  |
| `game.action`   | `game.action.accepted`, `game.action.rejected` |
|                 | `player.connected`, `player.disconnected`      |

Every client event is acknowledged with `{ ok, data | error }`. Reconnecting is simple on
purpose: on every `connect` the client sends `game.sync` and gets the latest snapshot; nothing
is replayed.

Room mutations (join, ready, start) go over REST; the socket only carries the resulting updates.

## Admin area

`apps/api/src/modules/admin` is HTTP only: controllers under `/api/admin/*` behind `AuthGuard`
and `AdminRoleGuard`, each delegating to the service that owns the thing being managed
(`GameConfigService`, `RoomsService`, `MatchesService`, `GameActionService`, `UsersService`).
No rule lives in the admin module. Lists are paged (`limit`, `offset`, a `total`) and built from
one page query plus batched lookups. Match listings select their columns explicitly and never
include `state` or the seed. How administrators sign in is ADR 0010.

## Hidden information

Raw state never leaves the server. `MatchesService.buildStateMessage` is the single exit, and it
always goes through `engine.getPublicView`. Each player has their own socket channel, so views
can differ per player. Action history and replay are served only after a match has finished,
because a log can reveal what a view hides.

## Deviations from the specification

- **Auth** for players is a username and nothing else (`POST /auth/guest`), with a 7-day token
  and no refresh. Administrators are the one exception: they sign in with a password
  (`POST /auth/admin/login`), and a name that has a password can never be opened by the
  username-only login. See ADR 0010.
- **`game_definitions`, `match_snapshots`, `invitations`** tables are not created: the registry
  is the source of truth for which games exist (`game_configs` holds their data), the current snapshot lives on `matches`, and invites are
  room codes.
- **`packages/validation`, `packages/eslint-config`** are not split out; there is one ESLint
  config at the root and validation lives next to its only consumer.
- **Repositories** are concrete Drizzle classes rather than interfaces plus adapters. Add the
  interface when a second implementation exists.
- **Logging** uses Nest's built-in logger (JSON in production) instead of Pino.
