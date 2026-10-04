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

Copy the layout of `packages/game-demo` (small), `packages/game-harmonies` (realistic) or
`packages/game-splendor` (realistic, with information hidden per player). `packages/game-werewolf`
is the one to read for secret roles, players acting at the same time, and eliminations;
`packages/game-avalon` for the same without bots, and sides that win together;
`packages/game-catan` for dice rolled during the match and answers given out of turn;
`packages/game-bang` for hands of cards, and actions that put the turn on hold until another
player has answered.

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
- The engine is handed the seed once, in `createInitialState`. Decide what you can up front
  (shuffles, the starting player). For randomness during the match, such as dice, keep the seed
  and a count of the draws made in the state and take each draw from
  `createSeededRandom` keyed on both, as `packages/game-catan/src/random/draw.ts` does. A
  replay then draws the same things. Never put either in the view.
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
- Settings that only suit some table sizes (a cast of roles) cannot be judged by
  `parseSettings`: nobody is seated yet. Implement the optional `validateSetup`, which the
  platform calls with the player count when the host starts the match; a refusal reaches the
  host as `INVALID_ROOM_SETTINGS` with your code. Export the check as a pure function so the
  `SettingsForm`, which is given `playerCount` once the room exists, can show the same answer.
- Bump `engineVersion` whenever the shape or meaning of the state changes.
- Illegal moves return a stable code. Use `CommonRuleCodes.NotYourTurn` for out-of-turn moves so
  the platform can report it as such.
- Several players may owe an action at once: `getCurrentPlayerIds` returns all of them, and
  must drop each one as soon as they have acted (bots are driven from it).
- The platform does not check whose turn it is: `validateAction` does. A player who must answer
  out of turn (a discard, a reply to an offer) is accepted there, listed in
  `getCurrentPlayerIds`, and given their own `legal` in the view, not only the active player.
- Never iterate a record keyed by player: the database stores state as `jsonb`, which does not
  keep key order, so a state loaded back would be walked differently. Walk the seat order.

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

## 4. Optionally, a computer player

Export a `bot: BotStrategy<View, Action>` from the game module to let hosts add bots. It gets
the seat's own view and must return one legal action for each of the three levels; `easy` can
be "any legal move". Having the view list the legal moves (as `legal` does in Harmonies) makes
this, and the UI, much simpler. `playBotMatch` from `@bgp/game-core/testing` plays bots against
each other and fails on any illegal action; use it to test legality and to compare levels.

## 5. Register the engine

`apps/api/src/modules/games/registered-games.ts`:

```ts
export const registeredGames: GameModule[] = [HarmoniesGame, SplendorGame, GridClaimGame, NewGame];
```

Add the package to `apps/api/package.json` dependencies, and its `package.json` to the list of
manifests copied in `deploy/Dockerfile`, then run `pnpm install` so the lockfile knows it.

## 6. Build the UI

Add the package to `apps/web/package.json` dependencies, then create
`apps/web/src/games/<name>/GameView.tsx`. It receives `GameViewProps`: the server's view,
the players, `sendAction`, and `disabled`. It renders the view and sends intent; it does not
decide what is legal. Have the engine's view say what the viewer may do (see `legal` in the
Harmonies view) rather than re-implementing rules in React.

Keep game-specific components inside the game's folder.

## 7. Register the UI

`apps/web/src/games/registry.ts`:

```ts
{ gameType: 'new-game', component: NewGameView },
```

Give it a `card` so the lobby can show it as more than a name: an emoji `icon`, a `hue` (0–360)
the card is tinted with, and a one-line `tagline` in each language of `shared/i18n/locales.ts`.
Without one the lobby shows the game's initial on a neutral card.

```ts
{
  gameType: 'new-game',
  card: { icon: '🎲', hue: 310, tagline: { vi: '…', en: '…' } },
  component: NewGameView,
},
```

A `SettingsForm` and its `describeSettings` word themselves in the viewer's language: the form
reads it with `useLocale()`, the summary is passed it. Keep the strings beside the form, one set
per language (see `games/splendor/SettingsForm.tsx`).

A game where several players act at once also sets `resendOnConflict: true`: an action that
lost a race to someone else's is then sent again on the fresh state, instead of being reported
to the player as refused.

The lobby, room, match page, reconnect and replay now work for the new game.
