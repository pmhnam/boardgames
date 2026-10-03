# 0006 — Socket.IO for realtime

**Decision.** Socket.IO through a NestJS gateway, one connection per user, no namespaces.

**Why.** Reconnection, rooms and acknowledgements are built in.

**Consequence.** Scaling beyond one instance needs the Redis adapter.
