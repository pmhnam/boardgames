# 0005 — Optimistic concurrency on `state_version`

**Decision.** Every action carries `expectedVersion`. The state is written with
`UPDATE … WHERE state_version = expected`; zero rows updated is a `GAME_VERSION_CONFLICT`.

**Why.** Two actions can arrive together. An in-memory lock stops working with a second API
instance; a compare-and-swap in the database does not.

**Consequence.** A conflicting client re-syncs and tries again. For a move chosen by looking at
the board, "tries again" is the player's call: the web shows the new state and the refusal. In a
game where players act at once (a vote, a night), the game's UI sets `resendOnConflict` and the
client sends the action again against the fresh version until it lands, at most once per other
player at the largest table. The server never retries or reorders: each attempt is an ordinary
action with a version the client really holds.
