# 0010 — Administrator accounts with a password

**Decision.** An administrator is an ordinary user row with `role = 'admin'` and a
`password_hash`. They sign in with `POST /auth/admin/login` and get the same kind of access token
as a player, plus a claim (`pv`) that fingerprints the password it was issued under. Admin
endpoints live under `/api/admin/*` behind `AuthGuard` and `AdminRoleGuard`; the role is read
from the database on every request, never from the token. The first administrator comes from
`ADMIN_USERNAME` and `ADMIN_PASSWORD` when the API starts. The shared `ADMIN_TOKEN` header is
gone.

**Why.**

- Players sign in with a name alone, so a role attached to a name would belong to whoever typed
  it. Anything an administrator can do has to sit behind a secret.
- A shared token says nothing about who acted. An account gives config versions an author and
  log lines a user id, and lets one administrator's access end without rotating everyone's.
- Reusing the user row and the token means the admin area needs no second session mechanism, in
  the API or in the browser.

**Consequences.**

- The username-only login refuses any account that has a password (`PASSWORD_REQUIRED`). This
  tells a caller that the name is an administrator's; the password length and sign-in throttling
  (per address and server-wide, counted before any hashing) are the defence.
- A token only counts while its `pv` matches the stored hash. So a username-only session held by
  someone whose name is later made an administrator stops working rather than becoming an admin
  session, and changing the password ends every session signed in with the old one.
- Passwords are hashed with scrypt from `node:crypto` (N=2^15, r=8, p=3), stored with their
  parameters so the cost can be raised later.
- Throttling reads the caller's address through the proxies in front of the API, so
  `TRUST_PROXY` must match the deployment (2 in production: the Cloudflare Tunnel, then nginx).
- There is one administrator, managed through the environment. Creating or demoting others from
  the admin area is not built.
- Disabling a player locks out a name, not a person: with username-only login they can return
  under another name. It ends their sessions and sockets at once and keeps the name from being
  used again.
- Admin actions are recorded as structured log lines (`game_config_published`,
  `match_abandoned`, …) and, for configs, in `game_configs.created_by`. There is no audit table.
