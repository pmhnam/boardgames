# 0002 — Server-authoritative game state

**Decision.** Clients send intent. The server validates it, computes the new state and
broadcasts it. Clients never send scores, next players, boards or winners.

**Why.** Anything a client can assert, a modified client can forge.

**Consequence.** The UI may preview or highlight moves, but only from data the server sent.
