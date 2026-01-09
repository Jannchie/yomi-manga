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
ARG VITE_API_BASE=http://localhost:4347
ENV VITE_API_BASE=$VITE_API_BASE
COPY --from=deps /pnpm /pnpm
COPY --from=deps /app/node_modules /app/node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /pnpm /pnpm
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/api/dist /app/packages/api/dist
COPY packages/api/package.json packages/api/package.json
EXPOSE 4347
CMD ["node", "packages/api/dist/index.js"]

FROM nginx:stable-alpine AS web
WORKDIR /usr/share/nginx/html
RUN cat <<'EOF' > /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html;
  }
}
EOF
COPY --from=build /app/packages/web/dist ./
EXPOSE 80
