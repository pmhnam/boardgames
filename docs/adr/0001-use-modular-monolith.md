# 0001 — Modular monolith

**Decision.** One NestJS application with one module per concern, one PostgreSQL database.

**Why.** Nothing here needs independent scaling or deployment yet, and a distributed system
would cost more than every feature built so far. Module boundaries keep a later split possible.

**Revisit when** a single API instance is no longer enough. The first step is Redis for the
Socket.IO adapter and presence, not services.
