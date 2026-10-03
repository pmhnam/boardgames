# 0004 — PostgreSQL `jsonb` for game state

**Decision.** A match's state is one `jsonb` column. Games do not get their own tables.

**Why.** Every game has a different state shape, and the platform never queries inside it.
Relational tables per game would mean a migration per game for no benefit.

**Note.** Development and tests use PGlite (Postgres compiled to WASM) when `DATABASE_URL` is
unset, so the same SQL and migrations run without a server.
