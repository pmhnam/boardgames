# Deployment

Every push to `main` that passes CI is deployed to the VPS by the `deploy` job in
`.github/workflows/ci.yml`.

## How it works

```text
push to main → CI (lint, build, typecheck, test) → ssh to the server with the commit sha
                                                        │
                        ~/apps/boardgames/deploy.sh  ◄──┘
                          1. fetch the repo, check the commit is on main, check it out
                          2. docker compose build      (deploy/Dockerfile)
                          3. docker compose up --wait  (deploy/compose.yaml)
```

The stack is three containers: `postgres`, `api` (NestJS) and `web` (nginx serving the React
build and forwarding `/api` and `/socket.io` to `api`). Nothing is published on the host. `web`
joins the server's `proxy` Docker network under the name `boardgames-web`, where the Cloudflare
Tunnel reaches it.

`up --wait` only succeeds once all three report healthy, so a commit that cannot start fails the
deploy job. Database migrations run when the API boots.

The CI SSH key is locked to the deploy script with a forced command: whatever it sends is read
as a commit sha, and only commits on `main` are accepted. It cannot open a shell on the server.

## Files

| File                      | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `deploy/Dockerfile`       | One build, two targets: `api` and `web`.             |
| `deploy/compose.yaml`     | The production stack.                                |
| `deploy/nginx.conf`       | Static files, SPA fallback, API and WebSocket proxy. |
| `deploy/server-deploy.sh` | Runs on the server. Installed as `deploy.sh`.        |
| `deploy/.env.example`     | The secrets the server's `.env` must define.         |

On the server:

```text
~/apps/boardgames/
  deploy.sh     copy of deploy/server-deploy.sh
  .env          secrets (never in git)
  repo/         checkout of this repository, managed by deploy.sh
```

## One-time setup

1. **Server directory and secrets.**

   ```bash
   mkdir -p ~/apps/boardgames && cd ~/apps/boardgames
   curl -fsSLo deploy.sh https://raw.githubusercontent.com/pmhnam/boardgames/main/deploy/server-deploy.sh
   chmod +x deploy.sh
   umask 077
   printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' \
     "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
   ```

   For the admin area at `/admin`, also add `ADMIN_USERNAME` and `ADMIN_PASSWORD` (12 or more
   characters) to that file. The account is created, or its password updated, the next time the
   API starts; without them there is no administrator and the admin area is off.

2. **A key for CI**, allowed to run only the deploy script. Generate it anywhere, then add the
   public half to the server's `~/.ssh/authorized_keys` as one line:

   ```text
   command="/home/ubuntu/apps/boardgames/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA... boardgames-ci
   ```

3. **GitHub secrets** (repository → Settings → Secrets and variables → Actions):

   | Secret            | Value                                        |
   | ----------------- | -------------------------------------------- |
   | `VPS_HOST`        | The server's address.                        |
   | `VPS_USER`        | `ubuntu`                                     |
   | `VPS_SSH_KEY`     | The private half of the CI key.              |
   | `VPS_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 <server>`. |

   Until `VPS_SSH_KEY` is set, the deploy job skips itself and CI stays green.

4. **Public hostname.** In the Cloudflare Zero Trust dashboard, add a public hostname to the
   tunnel pointing at `http://boardgames-web:80`.

## Operating it

Deploy a commit by hand, on the server:

```bash
~/apps/boardgames/deploy.sh <full commit sha>
```

Roll back by deploying an older commit the same way. Note that migrations only go forward: a
rollback across a schema change needs the database handled separately.

Logs and status:

```bash
docker compose -p boardgames logs -f api
docker compose -p boardgames ps
```

Back up the database:

```bash
docker compose -p boardgames exec -T postgres pg_dump -U bgp bgp | gzip > boardgames-$(date +%F).sql.gz
```

Changing a secret means editing `~/apps/boardgames/.env` and deploying again. Changing
`JWT_SECRET` signs everyone out.
