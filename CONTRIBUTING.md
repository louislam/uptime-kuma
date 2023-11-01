# Project Info

First of all, I want to thank everyone who made pull requests for Uptime Kuma. I never thought the GitHub Community would be so nice! Because of this, I also never thought that other people would actually read and edit my code. It is not very well structured or commented, sorry about that.

The project was created with vite.js (vue3). Then I created a subdirectory called "server" for the server part. Both frontend and backend share the same package.json.

The frontend code builds into "dist" directory. The server (express.js) exposes the "dist" directory as the root of the endpoint. This is how production is working.

## Key Technical Skills

- Node.js (You should know about promise, async/await and arrow function etc.)
- Socket.io
- SCSS
- Vue.js
- Bootstrap
- SQLite

## Directories

- config (dev config files)
- data (App data)
- db (Base database and migration scripts)
- dist (Frontend build)
- docker (Dockerfiles)
- extra (Extra useful scripts)
- public (Frontend resources for dev only)
- server (Server source code)
- src (Frontend source code)
- test (unit test)

## Can I create a pull request for Uptime Kuma?

Yes or no, it depends on what you will try to do. Since I don't want to waste your time, be sure to **create an empty draft pull request or open an issue, so we can have a discussion first**. Especially for a large pull request or you don't know if it will be merged or not.

Here are some references:

### ✅ Usually accepted

- Bug fix
- Security fix
- Adding notification providers
- Adding new language files (see [these instructions](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md))
- Adding new language keys: `$t("...")`

### ⚠️ Discussion required

- Large pull requests
- New features

### ❌ Won't be merged

- A dedicated PR for translating existing languages (see [these instructions](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md))
- Do not pass the auto-test
- Any breaking changes
- Duplicated pull requests
- Buggy
- UI/UX is not close to Uptime Kuma
- Modifications or deletions of existing logic without a valid reason.
- Adding functions that is completely out of scope
- Converting existing code into other programming languages
- Unnecessarily large code changes that are hard to review and cause conflicts with other PRs.

The above cases may not cover all possible situations.

I (@louislam) have the final say. If your pull request does not meet my expectations, I will reject it, no matter how much time you spend on it. Therefore, it is essential to have a discussion beforehand.

I will assign your pull request to a [milestone](https://github.com/louislam/uptime-kuma/milestones), if I plan to review and merge it.

Also, please don't rush or ask for an ETA, because I have to understand the pull request, make sure it is no breaking changes and stick to my vision of this project, especially for large pull requests.

### Recommended Pull Request Guideline

Before deep into coding, discussion first is preferred. Creating an empty pull request for discussion would be recommended.

1. Fork the project
1. Clone your fork repo to local
1. Create a new branch
1. Create an empty commit
   `git commit -m "[empty commit] pull request for <YOUR TASK NAME>" --allow-empty`
1. Push to your fork repo
1. Create a pull request: https://github.com/louislam/uptime-kuma/compare
1. Write a proper description
1. Click "Change to draft"
1. Discussion

## Project Styles

I personally do not like something that requires so many configurations before you can finally start the app. I hope Uptime Kuma installation will be as easy as like installing a mobile app.

- Easy to install for non-Docker users, no native build dependency is needed (for x86_64/armv7/arm64), no extra config, and no extra effort required to get it running
- Single container for Docker users, no very complex docker-compose file. Just map the volume and expose the port, then good to go
- Settings should be configurable in the frontend. Environment variables are discouraged, unless it is related to startup such as `DATA_DIR`
- Easy to use
- The web UI styling should be consistent and nice

## Coding Styles

- 4 spaces indentation
- Follow `.editorconfig`
- Follow ESLint
- Methods and functions should be documented with JSDoc

## Name Conventions

- Javascript/Typescript: camelCaseType
- SQLite: snake_case (Underscore)
- CSS/SCSS: kebab-case (Dash)

## Tools

- [`Node.js`](https://nodejs.org/) >= 14
- [`npm`](https://www.npmjs.com/) >= 8.5
- [`git`](https://git-scm.com/)
- IDE that supports [`ESLint`](https://eslint.org/) and EditorConfig (I am using [`IntelliJ IDEA`](https://www.jetbrains.com/idea/))
- A SQLite GUI tool (f.ex. [`SQLite Expert Personal`](https://www.sqliteexpert.com/download.html) or [`DBeaver Community`](https://dbeaver.io/download/))

### GitHub Codespace

If you don't want to setup an local environment, you can now develop on GitHub Codespace, read more:

https://github.com/louislam/uptime-kuma/tree/master/.devcontainer

## Git Branches

- `master`: 2.X.X development. If you want to add a new feature, your pull request should base on this.
- `1.23.X`: 1.23.X development. If you want to fix a bug for v1 and v2, your pull request should base on this.
- All other branches are unused, outdated or for dev.

## Install Dependencies for Development

```bash
npm ci
```

## Dev Server

(2022-04-26 Update)

We can start the frontend dev server and the backend dev server in one command.

Port `3000` and port `3001` will be used.

```bash
npm run dev
```

But sometimes, you would like to restart the server, but not the frontend, you can run these commands in two terminals:

```bash
npm run start-frontend-dev
npm run start-server-dev
```

## Backend Server

It binds to `0.0.0.0:3001` by default.

It is mainly a socket.io app + express.js.

express.js is used for:

- entry point such as redirecting to a status page or the dashboard
- serving the frontend built files (index.html, .js and .css etc.)
- serving internal APIs of the status page

### Structure in /server/

- jobs/ (Jobs that are running in another process)
- model/ (Object model, auto-mapping to the database table name)
- modules/ (Modified 3rd-party modules)
- monitor_types (Monitor Types)
- notification-providers/ (individual notification logic)
- routers/ (Express Routers)
- socket-handler (Socket.io Handlers)
- server.js (Server entry point)
- uptime-kuma-server.js (UptimeKumaServer class, main logic should be here, but some still in `server.js`)

## Frontend Dev Server

It binds to `0.0.0.0:3000` by default. The frontend dev server is used for development only.

For production, it is not used. It will be compiled to `dist` directory instead.

You can use Vue.js devtools Chrome extension for debugging.

### Build the frontend

```bash
npm run build
```

### Frontend Details

Uptime Kuma Frontend is a single page application (SPA). Most paths are handled by Vue Router.

The router is in `src/router.js`

As you can see, most data in the frontend is stored at the root level, even though you changed the current router to any other pages.

The data and socket logic are in `src/mixins/socket.js`.

## Database Migration

See: https://github.com/louislam/uptime-kuma/tree/master/db/knex_migrations

## Unit Test

```bash
npm run build
npm test
```

## Dependencies

Both frontend and backend share the same package.json. However, the frontend dependencies are eventually not used in the production environment, because it is usually also baked into dist files. So:

- Frontend dependencies = "devDependencies"
  - Examples: vue, chart.js
- Backend dependencies = "dependencies"
  - Examples: socket.io, sqlite3
- Development dependencies = "devDependencies"
  - Examples: eslint, sass

### Update Dependencies

Since previously updating Vite 2.5.10 to 2.6.0 broke the application completely, from now on, it should update the patch release version only.

Patch release = the third digit ([Semantic Versioning](https://semver.org/))

If for security / bug / other reasons, a library must be updated, breaking changes need to be checked by the person proposing the change.

## Translations

Please add **all** the strings which are translatable to `src/lang/en.json` (If translation keys are omitted, they can not be translated).

**Don't include any other languages in your initial Pull-Request** (even if this is your mother tongue), to avoid merge-conflicts between weblate and `master`.
The translations can then (after merging a PR into `master`) be translated by awesome people donating their language skills.

If you want to help by translating Uptime Kuma into your language, please visit the [instructions on how to translate using weblate](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md).

## Spelling & Grammar

Feel free to correct the grammar in the documentation or code.
My mother language is not English and my grammar is not that great.

## Wiki

Since there is no way to make a pull request to wiki's repo, I have set up another repo to do that.

https://github.com/louislam/uptime-kuma-wiki

## Docker

### Arch

- amd64
- arm64
- armv7

### Docker Tags

#### v2

- `2`, `latest-2`: v2 with full features such as Chromium and bundled MariaDB
- `2.x.x`
- `2-slim`: v2 with basic features
- `2.x.x-slim`
- `beta2`: Latest beta build
- `2.x.x-beta.x`
- `nightly2`: Dev build
- `base2`: Basic Debian setup without Uptime Kuma source code (Full features)
- `base2-slim`: Basic Debian setup without Uptime Kuma source code
- `pr-test2`: For testing pull request without setting up a local environment

#### v1

- `1`, `latest`, `1-debian`, `debian`: Latest version of v1
- `1.x.x`, `1.x.x-debian`
- `1.x.x-beta.x`: Beta build
- `beta`: Latest beta build
- `nightly`: Dev build
- `base-debian`: Basic Debian setup without Uptime Kuma source code
- `pr-test`: For testing pull request without setting up a local environment
- `base-alpine`: (Deprecated) Basic Alpine setup without Uptime Kuma source code
- `1-alpine`, `alpine`: (Deprecated)
- `1.x.x-alpine`: (Deprecated)

## Maintainer

Check the latest issues and pull requests:
https://github.com/louislam/uptime-kuma/issues?q=sort%3Aupdated-desc

### Release Procedures

1. Draft a release note
2. Make sure the repo is cleared
3. If the healthcheck is updated, remember to re-compile it: `npm run build-docker-builder-go`
4. `npm run release-final` with env vars: `VERSION` and `GITHUB_TOKEN`
5. Wait until the `Press any key to continue`
6. `git push`
7. Publish the release note as 1.X.X
8. Press any key to continue
9. Deploy to the demo server: `npm run deploy-demo-server`

Checking:

- Check all tags is fine on https://hub.docker.com/r/louislam/uptime-kuma/tags
- Try the Docker image with tag 1.X.X (Clean install / amd64 / arm64 / armv7)
- Try clean installation with Node.js

### Release Beta Procedures

1. Draft a release note, check "This is a pre-release"
2. Make sure the repo is cleared
3. `npm run release-beta` with env vars: `VERSION` and `GITHUB_TOKEN`
4. Wait until the `Press any key to continue`
5. Publish the release note as 1.X.X-beta.X
6. Press any key to continue

### Release Wiki

#### Setup Repo

```bash
git clone https://github.com/louislam/uptime-kuma-wiki.git
cd uptime-kuma-wiki
git remote add production https://github.com/louislam/uptime-kuma.wiki.git
```

#### Push to Production Wiki

```bash
git pull
git push production master
```

## Useful Commands

Change the base of a pull request such as `master` to `1.23.X`

```bash
git rebase --onto <new parent> <old parent>
```
