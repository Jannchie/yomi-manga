# Yomi Manga

Monorepo for the Yomi Manga application. It includes a Hono-based API and a Vue 3 web client, managed with pnpm workspaces.

## Purpose

Yomi Manga is a self-hosted manga library and reader. It scans a media library, serves metadata and images through the API, and provides a web UI for browsing, searching, and reading series.

## Requirements

- Node.js (LTS recommended)
- pnpm (workspace package manager)

## Getting Started

```bash
pnpm install
```

## Development Commands

```bash
pnpm dev        # Run API and web apps in parallel
pnpm dev:api    # Run API only
pnpm dev:web    # Run web only
pnpm build      # Build all packages
pnpm lint       # Lint the repo with ESLint
pnpm preview    # Preview the web build
pnpm sync       # Run API sync script
```

## Docker

Build the API image:

```bash
docker build --target api -t yomi-manga-api .
```

Run the API container (mount media and database):

```bash
docker run -p 4347:4347 \
  -e MANGA_ROOT=/data \
  -e DATABASE_URL=/data/data.db \
  -v /path/to/media:/data \
  yomi-manga-api
```

Build the web image (set API base URL):

```bash
docker build --target web \
  --build-arg VITE_API_BASE=http://localhost:4347 \
  -t yomi-manga-web .
```

Run the web container:

```bash
docker run -p 8080:80 yomi-manga-web
```

## Project Structure

```text
packages/
  api/          # Hono API (TypeScript)
  web/          # Vue 3 + Vite web client (TypeScript)
assets/         # Shared assets
scripts/        # Repo-level scripts
```

## Notes

- API entry: `packages/api/src/index.ts`
- Web entry: `packages/web/src/main.ts`
- Build output: `packages/*/dist/`
