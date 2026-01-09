# Yomi Manga

Monorepo for the Yomi Manga application. It includes a Hono-based API and a Vue 3 web client, managed with pnpm workspaces.

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
