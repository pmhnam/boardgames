# 0003 — Framework-independent game engines

**Decision.** Game packages depend only on `game-core`. No NestJS, React, Socket.IO, database or
Node built-ins. Engines are plain classes, not `@Injectable()`.

**Why.** The same engine runs on the server, in unit tests, in replay, and later in bots.

**Enforced by** ESLint import restrictions and by compiling game packages with no Node or DOM
types.
