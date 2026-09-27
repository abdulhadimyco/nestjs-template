FROM node:22-alpine AS base

ENV DIR=/app
WORKDIR $DIR
RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

FROM base AS build

ENV CI=true
RUN apk add --no-cache dumb-init

COPY package.json pnpm-lock.yaml ./
# `prepare` runs .husky/install.mjs (a no-op under CI=true); it must exist.
COPY .husky .husky
RUN pnpm install --frozen-lockfile

COPY tsconfig*.json .
COPY .swcrc .
COPY nest-cli.json .
COPY src src

RUN pnpm run build

FROM base AS production

ENV NODE_ENV=production
ENV USER=node
ARG PORT=3000
ENV PORT=${PORT}

COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init
COPY --from=build $DIR/package.json .
COPY --from=build $DIR/pnpm-lock.yaml .
COPY --from=build $DIR/dist dist
# No build scripts are needed at runtime; skip `prepare` (husky) and postinstalls.
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

USER $USER
EXPOSE ${PORT}
CMD ["dumb-init", "node", "dist/main.js"]
