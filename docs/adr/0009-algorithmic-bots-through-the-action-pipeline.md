# 0009 — Algorithmic bots, played through the action pipeline

**Decision.** Computer players are deterministic strategies that live in each game package and
are driven by the platform. A bot is a user in a seat; it is given only that seat's view, and
its actions go through `GameActionService` like a person's.

**Why.**

- Reusing the pipeline means bots get turn order, versioning, idempotency, the action log and
  replay for free, and cannot do anything a person could not.
- Deciding from the view rather than the state makes cheating impossible by construction.
- Algorithmic rather than an LLM: no per-move cost or latency, no external dependency, and
  strength that can be measured in tests (`playBotMatch`).

**Consequences.**

- Levels differ in search and evaluation, not in information. In Harmonies: random; greedy on a
  board evaluation; beam search over the whole hand plus awareness of when the game will end.
- The strategy contract returns one action per call, so multi-action turns are replanned on
  each call. Strategies must therefore be deterministic.
- An LLM opponent, or an LLM choosing among a strategy's candidate plans, can be added later
  behind the same contract; it would need an asynchronous step in the runner.
