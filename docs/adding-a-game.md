# Adding a game

Adding a game should touch four places and nothing in auth, rooms, matches, realtime or
persistence. If it needs more, the platform is missing a capability: add it generically.

## 1. Describe the game

Answer these before writing code.

```text
Game type:            (kebab-case id, e.g. "harmonies")
Display name:
Min / max players:

State:                what must be stored; what can be derived instead
Actions:              player intent only, never results
Turn model:           one active player? simultaneous?
Setup:
Randomness:           what the seed decides
Hidden information:   what each player must not see
Scoring:
End conditions:
Player view:
Spectator view:
Room settings:
Config:               what an operator may change without a code change
```

## 2. Create the package

Copy the layout of `packages/game-demo` (small) or `packages/game-harmonies` (realistic).

```text
packages/game-<name>/src/
  domain/       state, actions, rule codes, config type + defaults + parseConfig
  rules/        small pure functions: canX, validateY
  scoring/
  random/       everything derived from the seed
  visibility/   getPublicView
  engine/       createInitialState, parseAction, validateAction, applyAction, engine
  index.ts      exports the GameModule { definition, engine }
```

Rules for engine code:

- No I/O, no clock, no `Math.random`. Randomness comes from `createSeededRandom(seed)`; time
  comes from `context.now`.
- `applyAction` returns a new state and never mutates its input.
- Do not store what you can compute (scores, legal moves).
- `parseAction` copies only the fields it knows.
- `getPublicView` builds the view field by field. Never spread the state into it.
- Data an operator should be able to tune (boards, decks, counts, targets) goes in the game's
  config, not in constants. `defaultConfig` seeds the database; `parseConfig` must reject any
  config the engine could not play to the end. If rules need the config after setup, copy it
  into the state in `createInitialState`: that is the only time the platform hands it over.
- What a host should be able to choose per room (a map, a variant) is a setting.
  `parseSettings(raw, config)` validates it against the config and must return defaults for
  `undefined`. To let hosts pick it in the lobby, register a `SettingsForm` with the game's UI.
- Bump `engineVersion` whenever the shape or meaning of the state changes.
- Illegal moves return a stable code. Use `CommonRuleCodes.NotYourTurn` for out-of-turn moves so
  the platform can report it as such.

## 3. Test it

A game is done when it can be played start to finish from unit tests alone. Cover at least:

- every rule, legal and illegal, with its code;
- scoring and end conditions;
- no mutation (`runMatch` from `@bgp/game-core/testing` freezes every state);
- determinism: the same seed and actions give the same final state;
- invariants over whole random games (nothing duplicated, turns advance, scores finite);
- the view hides what it should;
- `parseConfig` accepts the default, rejects each kind of bad config, and a match set up from
  a non-default config plays by it.

## 4. Register the engine

`apps/api/src/modules/games/registered-games.ts`:

```ts
export const registeredGames: GameModule[] = [HarmoniesGame, GridClaimGame, NewGame];
```

Add the package to `apps/api/package.json` dependencies.

## 5. Build the UI

Create `apps/web/src/games/<name>/GameView.tsx`. It receives `GameViewProps`: the server's view,
the players, `sendAction`, and `disabled`. It renders the view and sends intent; it does not
decide what is legal. Have the engine's view say what the viewer may do (see `legal` in the
Harmonies view) rather than re-implementing rules in React.

Keep game-specific components inside the game's folder.

## 6. Register the UI

`apps/web/src/games/registry.ts`:

```ts
{ gameType: 'new-game', component: NewGameView },
```

The lobby, room, match page, reconnect and replay now work for the new game.
