# Copilot Instructions for Uptime Kuma

## Copilot's Goals/Tasks

- Check spelling
- Do not show "Pull Request Overview"
- You do not have to reply if there are no issues

## Repository Overview

**Uptime Kuma** is a self-hosted monitoring tool for HTTP(s), TCP, DNS, Docker, etc. Built with Vue 3 (frontend) and Node.js/Express (backend), using Socket.IO for real-time communication.

- **Languages**: JavaScript, Vue 3, TypeScript (limited), HTML, CSS/SCSS
- **Backend**: Node.js >= 20.4, Express.js, Socket.IO, SQLite
- **Frontend**: Vue 3, Vite, Bootstrap 5, Chart.js
- **Package Manager**: npm with `legacy-peer-deps=true` (.npmrc)

## Build & Validation Commands

### Prerequisites
- Node.js >= 20.4.0, npm >= 9.3, Git

### Essential Command Sequence

1. **Install Dependencies**:
   ```bash
   npm ci  # Use npm ci NOT npm install (~60-90 seconds)
   ```

2. **Linting** (required before committing):
   ```bash
   npm run lint         # Both linters (~15-30 seconds)
   npm run lint:prod    # For production (zero warnings)
   ```

3. **Build Frontend**:
   ```bash
   npm run build  # Takes ~90-120 seconds, builds to dist/
   ```

4. **Run Tests**:
   ```bash
   npm run test-backend  # Backend tests (~50-60 seconds)
   npm test              # All tests
   ```

### Development Workflow

```bash
npm run dev  # Starts frontend (port 3000) and backend (port 3001)
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
│   ├── server.js       Server entry point
│   └── uptime-kuma-server.js  Main server logic
├── src/                Frontend source code (Vue 3 SPA)
│   ├── components/     Vue components
│   ├── pages/          Page components
│   ├── lang/          i18n translations
│   ├── router.js      Vue Router configuration
│   └── main.js        Frontend entry point
├── db/                 Database related
│   ├── knex_migrations/  Knex migration files
│   └── kuma.db        SQLite database (gitignored)
├── test/               Test files
│   ├── backend-test/  Backend unit tests
│   └── e2e/           Playwright E2E tests
├── config/             Build configuration
│   ├── vite.config.js    Vite build config
│   └── playwright.config.js  Playwright test config
├── dist/               Frontend build output (gitignored)
├── data/               App data directory (gitignored)
├── public/             Static frontend assets (dev only)
├── docker/             Docker build files
└── extra/              Utility scripts
```

### Key Configuration Files

- **package.json**: Scripts, dependencies, Node.js version requirement
- **.eslintrc.js**: ESLint rules (4 spaces, double quotes, unix line endings, JSDoc required)
- **.stylelintrc**: Stylelint rules (4 spaces indentation)
- **.editorconfig**: Editor settings (4 spaces, LF, UTF-8)
- **tsconfig-backend.json**: TypeScript config for backend (only src/util.ts)
- **.npmrc**: `legacy-peer-deps=true` (required for dependency resolution)
- **.gitignore**: Excludes node_modules, dist, data, tmp, private

### Code Style (strictly enforced by linters)

- 4 spaces indentation, double quotes, Unix line endings (LF), semicolons required
- **Naming**: JavaScript/TypeScript (camelCase), SQLite (snake_case), CSS/SCSS (kebab-case)
- JSDoc required for all functions/methods

## CI/CD Workflows

**auto-test.yml** (runs on PR/push to master/1.23.X):
- Linting, building, backend tests on multiple OS/Node versions (15 min timeout)
- E2E Playwright tests

**validate.yml**: Validates JSON/YAML files, language files, knex migrations

**PR Requirements**: All linters pass, tests pass, code follows style guidelines

## Common Issues

1. **npm install vs npm ci**: Always use `npm ci` for reproducible builds
2. **TypeScript errors**: `npm run tsc` shows 1400+ errors - ignore them, they don't affect builds
3. **Stylelint warnings**: Deprecation warnings are expected, ignore them
4. **Test failures**: Always run `npm run build` before running tests
5. **Port conflicts**: Dev server uses ports 3000 and 3001
6. **First run**: Server shows "db-config.json not found" - this is expected, starts setup wizard

## Translations

- Managed via Weblate. Add keys to `src/lang/en.json` only
- Don't include other languages in PRs
- Use `$t("key")` in Vue templates

## Database

- Primary: SQLite (also supports MariaDB/MySQL/PostgreSQL)
- Migrations in `db/knex_migrations/` using Knex.js
- Filename format validated by CI: `node ./extra/check-knex-filenames.mjs`

## Testing

- **Backend**: Node.js test runner, fast unit tests
- **E2E**: Playwright (requires `npx playwright install` first time)
- Test data in `data/playwright-test`

## Adding New Features

### New Notification Provider
Files to modify:
1. `server/notification-providers/PROVIDER_NAME.js` (backend logic)
2. `server/notification.js` (register provider)
3. `src/components/notifications/PROVIDER_NAME.vue` (frontend UI)
4. `src/components/notifications/index.js` (register frontend)
5. `src/components/NotificationDialog.vue` (add to list)
6. `src/lang/en.json` (add translation keys)

### New Monitor Type
Files to modify:
1. `server/monitor-types/MONITORING_TYPE.js` (backend logic)
2. `server/uptime-kuma-server.js` (register monitor type)
3. `src/pages/EditMonitor.vue` (frontend UI)
4. `src/lang/en.json` (add translation keys)

## Important Notes

1. **Trust these instructions** - based on testing. Search only if incomplete/incorrect
2. **Dependencies**: 5 known vulnerabilities (3 moderate, 2 high) - acknowledged, don't fix without discussion
3. **Git Branches**: `master` (v2 development), `1.23.X` (v1 maintenance)
4. **Node Version**: >= 20.4.0 required
5. **Socket.IO**: Most backend logic in `server/socket-handlers/`, not REST
6. **Never commit**: `data/`, `dist/`, `tmp/`, `private/`, `node_modules/`
