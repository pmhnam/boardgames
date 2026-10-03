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

| Method               | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `defaultConfig`      | The config a fresh installation is seeded with.               |
| `parseConfig`        | Validate a config from the database or an admin request.      |
| `createInitialState` | Setup from players, a seed and a config. All randomness here. |
| `parseAction`        | Shape-check an untrusted payload; copy only known fields.     |
| `validateAction`     | Is this move legal? Returns a stable rule code if not.        |
| `applyAction`        | Returns a new state. Never mutates.                           |
| `getGameStatus`      | `playing` or `finished`.                                      |
| `getResult`          | Winners and scores, once finished.                            |
| `getPublicView`      | What a given player or spectator may see.                     |

Additions to the original specification: `defaultConfig` and `parseConfig` (see Game
configuration below), `parseAction` (so every action has runtime
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
- **Publishing.** `PUT /games/:gameType/config`, guarded by `ADMIN_TOKEN`. The platform passes
  the document to `engine.parseConfig` and stores the cleaned result; it never looks inside.
- **Starting a match.** The current config is re-validated, passed to `createInitialState`, and
  its version recorded in `matches.config_version`. An engine that needs the config after setup
  copies it into its state, as Harmonies does, so a match in progress is unaffected by later
  changes.
- **Replay.** Replay re-runs setup with the current config, so it is refused
  (`REPLAY_UNAVAILABLE`) for a match whose `config_version` is not the current one.

Config and rules are versioned separately. `config_version` changes when an operator publishes
data; `engine_version` changes when the code changes what a state means. A match saved by a
different engine version is refused outright (`MATCH_OUTDATED`).

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

## Hidden information

Raw state never leaves the server. `MatchesService.buildStateMessage` is the single exit, and it
always goes through `engine.getPublicView`. Each player has their own socket channel, so views
can differ per player. Action history and replay are served only after a match has finished,
because a log can reveal what a view hides.

## Deviations from the specification

- **Auth** is guest-only (`POST /auth/guest`), with a 7-day token and no refresh. There are no
  user roles; operator endpoints use a shared `ADMIN_TOKEN`.
- **`game_definitions`, `match_snapshots`, `invitations`** tables are not created: the registry
  is the source of truth for which games exist (`game_configs` holds their data), the current snapshot lives on `matches`, and invites are
  room codes.
- **`packages/validation`, `packages/eslint-config`** are not split out; there is one ESLint
  config at the root and validation lives next to its only consumer.
- **Repositories** are concrete Drizzle classes rather than interfaces plus adapters. Add the
  interface when a second implementation exists.
- **Logging** uses Nest's built-in logger (JSON in production) instead of Pino.
