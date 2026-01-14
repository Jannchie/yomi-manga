# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_PATH=/pnpm/store
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
RUN apk add --no-cache python3 make g++
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/packages/api/node_modules /app/packages/api/node_modules
COPY --from=deps /app/packages/web/node_modules /app/packages/web/node_modules
COPY . .
RUN pnpm build

FROM base AS prod-deps
RUN apk add --no-cache python3 make g++
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/api/package.json packages/api/package.json
COPY packages/web/package.json packages/web/package.json
RUN pnpm install --frozen-lockfile --prod --filter ./packages/api...

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache nginx supervisor
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/packages/api/node_modules /app/packages/api/node_modules
COPY --from=build /app/packages/api/dist /app/packages/api/dist
COPY packages/api/package.json packages/api/package.json
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
EXPOSE 80
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
