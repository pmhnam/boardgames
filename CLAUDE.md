# Board Game Platform

pnpm + Turborepo monorepo. NestJS API (`apps/api`), React web (`apps/web`), game engines as pure
packages (`packages/game-*`). Read `docs/architecture.md` and `docs/adding-a-game.md` first.

## Commands

- `pnpm dev` — API :3000, web :5173. No database setup needed (embedded PGlite).
- `pnpm test`, `pnpm typecheck`, `pnpm lint` — run all three before calling work done.
- `pnpm db:generate` — after editing `apps/api/src/infrastructure/database/schema.ts`.

Everything is ESM: relative imports in `apps/api` and `packages/*` need a `.js` extension.
The API consumes packages from `dist/`, so rebuild a package (`pnpm build`, or keep `pnpm dev`
running) before its changes show up in API typechecks and tests.

## Rules

1. Game engines stay framework-independent and deterministic: no I/O, no `Math.random`, no
   `Date.now`. Randomness comes from the seed, time from `context.now`.
2. Controllers and gateways stay thin. Game rules never go in platform modules or in React.
3. Raw game state never leaves the server; everything goes through `engine.getPublicView`.
4. Every state change goes through `GameActionService` (version check, idempotency, atomic save).
5. No `switch (gameType)`. Use the registries.
6. Every rule has a unit test.
7. Do not add a shared game abstraction until two games need it.
8. A game's tunable data (boards, decks, counts) lives in the `game_configs` table, versioned
   and append-only. Engine defaults only seed version 1. Never edit or delete a config row.
9. Bots decide from `engine.getPublicView` for their own seat only, and act through
   `GameActionService` like any player. Never hand a bot the raw state.
10. Errors carry stable codes from `@bgp/shared-types` `ErrorCodes`; clients never parse messages.
