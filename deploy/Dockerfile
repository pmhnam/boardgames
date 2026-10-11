# syntax=docker/dockerfile:1
# One build, two images: `--target api` and `--target web`.

FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo

# The lockfile alone says what to download, so this layer is reused until it changes: adding a
# game or editing a manifest does not fetch every dependency again.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline
RUN pnpm turbo run build

# The API with production dependencies only, workspace packages included. What only a developer
# reads is left behind: sources, tests, build settings and source maps.
RUN pnpm --filter @bgp/api deploy --prod --legacy /out/api \
  && cd /out/api \
  && rm -rf src test nest-cli.json drizzle.config.ts vitest.config.ts tsconfig*.json *.tsbuildinfo \
  && find . -name '*.map' -delete


FROM node:24-alpine AS api
LABEL org.opencontainers.image.source="https://github.com/pmhnam/boardgames"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]


# The slim image is nginx without the optional modules, none of which this site uses.
FROM nginx:1.29-alpine-slim AS web
LABEL org.opencontainers.image.source="https://github.com/pmhnam/boardgames"
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
