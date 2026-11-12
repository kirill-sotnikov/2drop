# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY protocol/package.json ./protocol/package.json
COPY service/package.json ./service/package.json
COPY web/package.json ./web/package.json
RUN yarn install --immutable

FROM dependencies AS service-build
COPY tsconfig.base.json ./
COPY protocol ./protocol
COPY service ./service
RUN yarn workspace service build
RUN yarn workspaces focus service --production

FROM node:24-bookworm-slim AS service
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
COPY --from=service-build --chown=node:node /app/node_modules ./node_modules
COPY --from=service-build --chown=node:node /app/service/dist ./service/dist
USER node
EXPOSE 3001
CMD ["node", "service/dist/index.mjs"]

FROM dependencies AS web-build
COPY tsconfig.base.json ./
COPY protocol ./protocol
COPY web ./web
ARG NEXT_PUBLIC_SIGNALING_URL
ARG NEXT_PUBLIC_ICE_TRANSPORT_POLICY=all
ENV NEXT_TELEMETRY_DISABLED=1
RUN test -n "$NEXT_PUBLIC_SIGNALING_URL" && yarn workspace web build

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8081
COPY --from=web-build --chown=node:node /app/web/.next/standalone ./
COPY --from=web-build --chown=node:node /app/web/.next/static ./web/.next/static
USER node
EXPOSE 8081
CMD ["node", "web/server.js"]
