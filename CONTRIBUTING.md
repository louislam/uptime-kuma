# Project Info

First of all, I want to thank everyone who have wrote issues or shared pull requests for Uptime Kuma.
I never thought the GitHub community would be so nice!
Because of this, I also never thought that other people would actually read and edit my code.
Parts of the code are not very well-structured or commented, sorry about that.

The project was created with `vite.js` and is written in `vue3`.
Our backend lives in the `server`-directory and mostly communicates via websockets.
Both frontend and backend share the same `package.json`.

For production, the frontend is build into `dist`-directory and the server (`express.js`) exposes the `dist` directory as the root of the endpoint.
For development, we run vite in development mode on another port. 

## Directories

- `config` (dev config files)
- `data` (App data)
- `db` (Base database and migration scripts)
- `dist` (Frontend build)
- `docker` (Dockerfiles)
- `extra` (Extra useful scripts)
- `public` (Frontend resources for dev only)
- `server` (Server source code)
- `src` (Frontend source code)
- `test` (unit test)

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

I ([@louislam](https://github.com/louislam)) have the final say. If your pull request does not meet my expectations, I will reject it, no matter how much time you spent on it. Therefore, it is essential to have a discussion beforehand.

I will assign your pull request to a [milestone](https://github.com/louislam/uptime-kuma/milestones), if I plan to review and merge it.

Please don't rush or ask for an ETA.
We have to understand the pull request, make sure it has no breaking changes and stick to the vision of this project, especially for large pull requests.


## I'd like to work on an issue. How do I do that?

We have found that assigning people to issues is management-overhead that we don't need.
A short comment that you want to try your hand at this issue is appreciated to save other devs time.
If you come across any problem during development, feel free to leave a comment with what you are stuck on.

### Recommended Pull Request Guideline

Before diving deep into coding, having a discussion first by creating an empty pull request for discussion is preferred.
The rationale behind this is that we can align the direction and scope of the feature to eliminate any conflicts with existing and planned work, and can help by pointing out any potential pitfalls.

1. Fork the project
2. Clone your fork repo to local
3. Create a new branch
4. Create an empty commit: `git commit -m "<YOUR TASK NAME>" --allow-empty`
5. Push to your fork repo
6. Prepare a pull request: https://github.com/louislam/uptime-kuma/compare
7. Write a proper description. You can mention @louislam in it, so @louislam will get the notification.
8. Create your pull request as a Draft
9. Wait for the discussion

## Project Styles

I personally do not like something that requires so many configurations before you can finally start the app.
The goal is to make the Uptime Kuma installation as easy as installing a mobile app.

- Easy to install for non-Docker users
  - no native build dependency is needed (for `x86_64`/`armv7`/`arm64`)
  - no extra configuration and
  - no extra effort required to get it running
- Single container for Docker users
  - no complex docker-compose file
  - mapping the volume and exposing the port should be the only requirements
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

### GitHub Codespaces

If you don't want to setup an local environment, you can now develop on GitHub Codespaces, read more:

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

It is mainly a `socket.io`-app, but includes `express.js` to serve:

- as an entry point for redirecting to a status page or the dashboard
- the frontend built files (`index.html`, `*.js`, `*.css`, etc.)
- internal APIs of the status page

### Structure in `/server/`

- `jobs/` (Jobs that are running in another process)
- `model/` (Object model, auto-mapping to the database table name)
- `modules/` (Modified 3rd-party modules)
- `monitor_types/` (Monitor Types)
- `notification-providers/` (individual notification logic)
- `routers/` (Express Routers)
- `socket-handler/` (Socket.io Handlers)
- `server.js` (Server entry point)
- `uptime-kuma-server.js` (UptimeKumaServer class, main logic should be here, but some still in `server.js`)

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

Both frontend and backend share the same `package.json`.
However, the frontend dependencies are eventually not used in the production environment, because it is usually also baked into `dist` files. So:

- Frontend dependencies = "devDependencies"
  - Examples: `vue`, `chart.js`
- Backend dependencies = "dependencies"
  - Examples: `socket.io`, `sqlite3`
- Development dependencies = "devDependencies"
  - Examples: `eslint`, `sass`

### Update Dependencies

Since previously updating Vite 2.5.10 to 2.6.0 broke the application completely, from now on, it should update the patch release version only.

Patch release = the third digit ([Semantic Versioning](https://semver.org/))

If for security / bug / other reasons, a library must be updated, breaking changes need to be checked by the person proposing the change.

## Translations

Please add **all** the strings which are translatable to `src/lang/en.json` (if translation keys are omitted, they can not be translated.)

**Don't include any other languages in your initial pull request** (even if this is your mother tongue), to avoid merge-conflicts between weblate and `master`.
The translations can then (after merging a PR into `master`) be translated by awesome people donating their language skills.

If you want to help by translating Uptime Kuma into your language, please visit the [instructions on how to translate using weblate](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md).

## Spelling & Grammar

Feel free to correct the grammar in the documentation or code.
My mother language is not English and my grammar is not that great.

## Wiki

Since there is no way to make a pull request to the wiki, I have set up another repo to do that.

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

### What is a maintainer and what are their roles?

This project has multiple maintainers which specialise in different areas.
Currently, there are 3 maintainers:

| Person            | Role              | Main Area        |
|-------------------|-------------------|------------------|
| `@louislam`       | senior maintainer | major features   |
| `@chakflying`     | junior maintainer | fixing bugs      |
| `@commanderstorm` | junior maintainer | issue-management |

### Procedures

We have a few procedures we follow. These are documented here:

- <details><summary>Release</summary>
  <p>

  1. Draft a release note
  2. Make sure the repo is cleared
  3. If the healthcheck is updated, remember to re-compile it: `npm run build-docker-builder-go`
  4. `npm run release-final` with env vars: `VERSION` and `GITHUB_TOKEN`
  5. Wait until the `Press any key to continue`
  6. `git push`
  7. Publish the release note as `1.X.X`
  8. Press any key to continue
  9. Deploy to the demo server: `npm run deploy-demo-server`

  These Items need to be checked:

  - [ ] Check all tags is fine on https://hub.docker.com/r/louislam/uptime-kuma/tags
  - [ ] Try the Docker image with tag 1.X.X (Clean install / amd64 / arm64 / armv7)
  - [ ] Try clean installation with Node.js
  
  </p>
  </details>
- <details><summary>Release Beta</summary>
  <p>

  1. Draft a release note, check `This is a pre-release`
  2. Make sure the repo is cleared
  3. `npm run release-beta` with env vars: `VERSION` and `GITHUB_TOKEN`
  4. Wait until the `Press any key to continue`
  5. Publish the release note as `1.X.X-beta.X`
  6. Press any key to continue
  
  </p>
  </details>
- <details><summary>Release Wiki</summary>
  <p>

  **Setup Repo**
  
  ```bash
  git clone https://github.com/louislam/uptime-kuma-wiki.git
  cd uptime-kuma-wiki
  git remote add production https://github.com/louislam/uptime-kuma.wiki.git
  ```
  
  **Push to Production Wiki**
  
  ```bash
  git pull
  git push production master
  ```
  
  </p>
  </details>
- <details><summary>Change the base of a pull request such as <code>master</code> to <code>1.23.X</code></summary>
  <p>
  
  ```bash
  git rebase --onto <new parent> <old parent>
  ```
  
  </p>
  </details>
