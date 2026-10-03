# 0007 — Action log plus current snapshot

**Decision.** Store the current state and an append-only log of actions, written in one
transaction. Do not build full event sourcing.

**Why.** The log gives replay, debugging and idempotency (`request_id` is unique per match).
The snapshot makes loading a match one row read. Event sourcing would add projections and
versioned events without a requirement that needs them.

**Consequence.** Replay depends on engines being deterministic and on `engine_version` matching.
