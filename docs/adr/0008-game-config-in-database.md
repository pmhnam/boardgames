# 0008 — Game configuration in the database, versioned

**Decision.** Each game's tunable data is one `jsonb` document per version in `game_configs`
(primary key `game_type, version`), append-only. The engine defines the shape, supplies the
default that seeds version 1, and validates every document with `parseConfig`. A match records
the version it was set up with, and an engine that needs the config during play keeps a copy in
its state.

**Why.** Boards, decks and counts should change without a deploy. One document per version
rather than tables per concept (`animal_cards`, `board_cells`, …) because every game's data has a
different shape, a config is only valid as a whole, and the platform never queries inside it:
the same reasoning as ADR 0004.

**Consequences.**

- Publishing a config never disturbs a match in progress.
- Replay re-runs setup with the current config, so a match from an older config version cannot
  be replayed. This was chosen for simplicity. Every version is kept, so replaying against a
  match's own version later only means loading that row instead of the latest.
- Publishing is guarded by a shared `ADMIN_TOKEN`, since there are no user roles yet.
  (Superseded by ADR 0010: publishing now needs an administrator account.)
