# 0005 — Optimistic concurrency on `state_version`

**Decision.** Every action carries `expectedVersion`. The state is written with
`UPDATE … WHERE state_version = expected`; zero rows updated is a `GAME_VERSION_CONFLICT`.

**Why.** Two actions can arrive together. An in-memory lock stops working with a second API
instance; a compare-and-swap in the database does not.

**Consequence.** A conflicting client re-syncs and tries again.
