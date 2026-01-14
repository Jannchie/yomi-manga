# Repository Guidelines

## Project Structure & Module Organization

- `packages/api/`: Hono API (TypeScript). Entry at `packages/api/src/index.ts`; database and schema in `packages/api/src/db.ts` and `packages/api/src/schema.ts`. Scripts live in `packages/api/src/scripts/`.
- `packages/web/`: Vue 3 + Vite client. Entry at `packages/web/src/main.ts`; pages in `packages/web/src/pages/`, components in `packages/web/src/components/`, locales in `packages/web/src/locales/`.
- `packages/web/public/`: static assets; `assets/` contains shared repo assets; build output goes to `packages/*/dist/`.

## Build, Test, and Development Commands

```bash
pnpm dev        # Run API and web in parallel
pnpm dev:api    # Run API only (tsx watch)
pnpm dev:web    # Run web only (Vite dev server)
pnpm build      # Build all packages
pnpm lint       # Lint the repo with ESLint
pnpm preview    # Preview the web build
pnpm sync       # Run API sync script
```

## Coding Style & Naming Conventions

- Use TypeScript and ES modules throughout.
- Indentation is 2 spaces; strings use single quotes; no semicolons in TS/JS.
- Vue components use PascalCase (e.g., `StarRating.vue`), pages use `*Page.vue`, and API modules use lower-case file names (e.g., `db.ts`).
- Lint with `pnpm lint` (ESLint with `@jannchie/eslint-config`).

## Testing Guidelines

- No automated tests are configured yet and there is no `pnpm test` script.
- If adding tests, use Vitest for the web package and place tests as `*.test.ts`/`*.spec.ts` near the source or under `__tests__/`. Add a `test` script in `packages/web/package.json`.

## Commit & Pull Request Guidelines

- Follow Conventional Commits with optional scopes, matching the existing history (e.g., `feat(web): add i18n support`).
- PRs should include a concise summary, test status (commands and results), and screenshots or short clips for UI changes. Link related issues when available.

## Configuration & Data

- The API uses a local SQLite database at `packages/api/data.db`; treat it as local state unless you intend to update shared data.
- Media root can be configured via `MANGA_ROOT`; `IMAGE_MAX_AGE` controls cache headers.

## Changelog

Changelogs are maintained in `CHANGELOG.md` using Keep a Changelog format. Update it with each release, following semantic versioning. You must use Chinese.
