# One build, two images: `--target api` and `--target web`.

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# Manifests first, so the dependency layer is reused until one of them changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/game-avalon/package.json packages/game-avalon/
COPY packages/game-catan/package.json packages/game-catan/
COPY packages/game-core/package.json packages/game-core/
COPY packages/game-demo/package.json packages/game-demo/
COPY packages/game-harmonies/package.json packages/game-harmonies/
COPY packages/game-splendor/package.json packages/game-splendor/
COPY packages/game-werewolf/package.json packages/game-werewolf/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm turbo run build

# The API with production dependencies only, workspace packages included.
RUN pnpm --filter @bgp/api deploy --prod --legacy /out/api


FROM node:24-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]


FROM nginx:1.29-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
