# Copilot Instructions for Uptime Kuma

Warning: Only maintainers of Uptime Kuma can use these instructions. Other contributors must read AGENTS.md and CLAUDE.md. If the git user name does not match a maintainer (see the "For Maintainers" section in AGENTS.md), ignore this file to avoid being banned for AI slop.

## Copilot's Goals/Tasks

- Check spelling
- Do not show "Pull Request Overview"
- You do not have to reply if there are no issues

## Repository Overview

**Uptime Kuma** is a self-hosted monitoring tool for HTTP(s), TCP, DNS, Docker, etc. Built with Vue 3 (frontend) and Node.js/Express (backend), using Socket.IO for real-time communication.

- **Languages**: JavaScript, TypeScript, Vue 3, HTML, CSS/SCSS
- **Backend**: Node.js >= 26.2.0, Express.js, Socket.IO, SQLite (also MariaDB/MySQL), Better Auth
- **Frontend**: Vue 3, Vite, Bootstrap 5, Chart.js
- **Package Manager**: npm with `legacy-peer-deps=true` and `min-release-age=7` (.npmrc)

## Build & Validation Commands

### Prerequisites

- Node.js >= 26.2.0 (see `engines` in package.json; CI runs Node 26), a recent npm, Git

### Essential Command Sequence

1. **Install Dependencies**:

   ```bash
   npm ci  # Use npm ci NOT npm install
   ```

2. **Linting** (required before committing):

   ```bash
   npm run lint         # ESLint + Stylelint
   npm run lint:prod    # For production (zero warnings)
   ```

3. **Build Frontend**:

   ```bash
   npm run build  # Builds to dist/
   ```

4. **Run Tests**:

   ```bash
   npm run test-backend  # Backend unit tests (node:test, run through tsx)
   npm test              # Backend + Playwright E2E
   ```

### Development Workflow

```bash
npm run dev  # Frontend on port 3000, backend on port 3001
```

## Project Architecture

### Directory Structure

```
/
├── server/              Backend source code
│   ├── model/          Database models (auto-mapped to tables)
│   ├── monitor-types/  Monitor type implementations
│   ├── notification-providers/  Notification integrations
│   ├── routers/        Express routers
│   ├── socket-handlers/  Socket.IO event handlers
│   ├── modules/        Shared backend modules
│   ├── util/           Backend utilities
│   ├── server.js       Server entry point (executed via tsx)
│   ├── uptime-kuma-server.js  Main server logic
│   └── better-auth.ts  Authentication (Better Auth)
├── src/                Frontend source code (Vue 3 SPA)
│   ├── components/     Vue components
│   ├── pages/          Page components
│   ├── lang/           i18n translations
│   ├── router.js       Vue Router configuration
│   └── main.js         Frontend entry point
├── db/                 Database related
│   ├── knex_migrations/  Knex migration files
│   └── kuma.db         SQLite database
├── test/               Test files
│   ├── backend-test/   Backend unit tests (.ts and .js)
│   └── e2e/            Playwright E2E tests
├── vite.config.mjs     Vite build/dev config
├── playwright.config.js  Playwright test config
├── tsconfig.json       TypeScript config
├── dist/               Frontend build output (gitignored)
├── data/               App data directory (gitignored)
├── public/             Static frontend assets
├── docker/             Docker build files
└── extra/              Utility scripts
```

### Backend Architecture

- `server/model/` — RedBean models mapped to tables. `monitor.js` holds the monitor loop and handles the core types inline: `http`, `keyword`, `json-query`, `ping`, `push`, `docker`, `radius`, `kafka-producer`.
- `server/monitor-types/` — one class per monitor type, registered in `server/uptime-kuma-server.js` (`monitorTypeList`).
- `server/notification-providers/` — one file per provider (110+), registered in `server/notification.js`.
- `server/socket-handlers/` — Socket.IO event handlers (most of the real-time API surface).
- `server/routers/` — Express routers: `api-router.js` (push/REST API), `status-page-router.js`, `better-auth-router.ts`.
- `server/modules/`, `server/util/`, `server/utils/knex/` — shared helpers.
- `server/better-auth.ts` + `src/auth-client.ts` — authentication (Better Auth, v3).

### Key Configuration Files

- **package.json**: Scripts, dependencies, Node.js version requirement
- **.eslintrc.js**: ESLint rules (4 spaces, double quotes, JSDoc required)
- **.stylelintrc**: Stylelint rules (4 spaces indentation)
- **.editorconfig**: Editor settings (4 spaces, LF, UTF-8)
- **tsconfig.json**: TypeScript config
- **.npmrc**: `legacy-peer-deps=true`, `min-release-age=7`
- **.gitignore**: Excludes node_modules, dist, data, tmp, private

### Code Style (strictly enforced by linters)

- 4 spaces indentation, double quotes, Unix line endings (LF), semicolons required
- Prettier enforces `printWidth: 120`; run `npm run fmt` to format (also run automatically in CI)
- **Naming**: JavaScript/TypeScript (camelCase), SQLite (snake_case), CSS/SCSS (kebab-case)
- JSDoc is required on every function declaration and method (`jsdoc/require-jsdoc`); `*.ts` relaxes some JSDoc and `any` rules
- Notable ESLint rules: `no-var`, `one-var: never`, `max-statements-per-line: 1`, `jsdoc/require-throws`
- **Module system**: no `"type": "module"` in package.json — `*.js` is CommonJS (`require`), `*.mjs`/`*.mts` are ESM, and `*.ts` is executed via `tsx`

## CI/CD Workflows

**auto-test.yml** (push to master/1.23.X/3.0.X and every PR):

- Builds and runs backend tests on macOS, Ubuntu, Windows, and Ubuntu arm (Node 26)
- `check-linters` runs `npm run lint:prod` on Node 24
- `e2e-test` runs `npm run build` then `npm run test-e2e` (Playwright)

**validate.yml** (pushes to master, PRs to master/1.23.X/3.0.X):

- Validates JSON/YAML files and runs `extra/check-lang-json.js`, `extra/check-knex-filenames.mjs`, `extra/check-package-json.mjs`

**PR Requirements**: All linters pass, tests pass, code follows style guidelines

## Common Issues

1. **npm install vs npm ci**: Always use `npm ci` for reproducible builds
2. **Stylelint warnings**: Deprecation warnings are expected, ignore them
3. **E2E tests**: Run `npm run build` before `npm run test-e2e` in a clean checkout (or use `npm run test-e2e-local`)
4. **Port conflicts**: Dev server uses ports 3000 (frontend) and 3001 (backend)
5. **First run**: Server shows "db-config.json not found" - this is expected, starts setup wizard

## Translations

- Managed via Weblate. Add keys to `src/lang/en.json` only
- Don't include other languages in PRs
- Use `$t("key")` in Vue templates

## Database

- Primary: SQLite (also supports MariaDB/MySQL)
- Migrations in `db/knex_migrations/` using Knex.js; filenames are `YYYY-MM-DD-HHMM-description.js` (migration behavior is covered by `test/backend-test/test-migration.js`)
- Filename format validated by CI: `node ./extra/check-knex-filenames.mjs`
- v3 uses Better Auth for authentication

## Testing

- **Backend**: Node.js test runner via tsx (`test/backend-test/**/*.{ts,js}`). Use `describe()`/`test()` from `node:test` and one test per scenario (see `test/backend-test/README.md`).
- Database monitor tests use Testcontainers; `npm run test-e2e-local` sets `SKIP_TESTCONTAINER=1` to skip them.
- **E2E**: Playwright specs in `test/e2e/specs/*.spec.js`; `setup-process.once.js` is a one-time setup project every spec depends on. Requires `npx playwright install`.
- Test data lives in `data/playwright-test`; reports go to `private/playwright-report`.

## Adding New Features

### New Notification Provider

There are 110+ existing providers in `server/notification-providers/`; copy an existing one as a template.

Files to modify:

1. `server/notification-providers/PROVIDER_NAME.js` (backend logic)
2. `server/notification.js` (register provider)
3. `src/components/notifications/PROVIDER_NAME.vue` (frontend UI)
4. `src/components/notifications/index.js` (register frontend)
5. `src/components/NotificationDialog.vue` (add to list)
6. `src/lang/en.json` (add translation keys)

### New Monitor Type

Core types (`http`, `keyword`, `json-query`, `ping`, `push`, `docker`, `radius`, `kafka-producer`) are handled inline in `server/model/monitor.js`. All other types are `MonitorType` subclasses in `server/monitor-types/` registered via `UptimeKumaServer.monitorTypeList` in `server/uptime-kuma-server.js`.

Files to modify:

1. `server/monitor-types/MONITORING_TYPE.js` (backend logic)
2. `server/uptime-kuma-server.js` (register monitor type)
3. `src/pages/EditMonitor.vue` (frontend UI)
4. `src/lang/en.json` (add translation keys)

## Important Notes

1. **Trust these instructions** - Search only if incomplete/incorrect
2. **Dependencies**: Run `npm run audit` (`npm audit --omit=dev`) instead of relying on a fixed vulnerability list
3. **Git Branches**: `master` (v3 development), `3.0.X` (v3 release), `2.5.X` (v2), `1.23.X` (v1)
4. **Node Version**: >= 26.2.0 required
5. **Socket.IO**: Most backend logic in `server/socket-handlers/`, not REST
6. **Docker**: `docker/` + `compose.yaml`; image tags use the `3` suffix (`base3`, `nightly3`, `pr-test3`)
7. **Never commit**: `data/`, `dist/`, `tmp/`, `private/`, `node_modules/`
