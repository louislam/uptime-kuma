# Project Info

First of all, I want to thank everyone who has submitted issues or shared pull
requests for Uptime Kuma. I never thought the GitHub community would be so nice!
Because of this, I also never thought that other people would actually read and
edit my code. Parts of the code are not very well-structured or commented, sorry
about that.

The project was created with `vite.js` and is written in `vue3`. Our backend
lives in the `server`-directory and mostly communicates via websockets. Both
frontend and backend share the same `package.json`.

For production, the frontend is built into the `dist`-directory and the server
(`express.js`) exposes the `dist` directory as the root of the endpoint. For
development, we run vite in development mode on another port.

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

## Can I Create a Pull Request for Uptime Kuma?

Whether or not you can create a pull request depends on the nature of your
contribution. We value both your time and our maintainers' time, so we want to
make sure it's spent efficiently.

If you're unsure about any process or step, you're probably not the only one
with that question—please feel free to ask. We're happy to help!

Different types of pull requests (PRs) may have different guidelines, so be sure
to review the appropriate one for your contribution.

- <details><summary><b>Security Fixes</b> (click to expand)</summary>
  <p>

  Submitting security fixes is something that may put the community at risk.
  Please read through our [security policy](SECURITY.md) and submit
  vulnerabilities via an [advisory] + [issue] instead. We encourage you to
  submit how to fix a vulnerability if you know how to, this is not required.
  Following the security policy allows us to properly test, fix bugs. This
  review allows us to notice, if there are any changes necessary to unrelated
  parts like the documentation.
  [**PLEASE SEE OUR SECURITY POLICY.**](SECURITY.md)

  [advisory]: https://github.com/louislam/uptime-kuma/security/advisories/new
  [issue]:
    https://github.com/louislam/uptime-kuma/issues/new?template=security_issue.yml

  </p>
  </details>

- <details><summary><b>Small, Non-Breaking Bug Fixes</b> (click to expand)</summary>
  <p>

  If you come across a bug and think you can solve, we appreciate your work.
  Please make sure that you follow these rules:

  - keep the PR as small as possible, fix only one thing at a time => keeping it
    reviewable
  - test that your code does what you claim it does.

  <sub>Because maintainer time is precious, junior maintainers may merge
  uncontroversial PRs in this area.</sub>

  </p>
  </details>

- <details><summary><b>Translations / Internationalisation (i18n)</b> (click to expand)</summary>
  <p>

  We use weblate to localise this project into many languages. If you are
  unhappy with a translation this is the best start. On how to translate using
  weblate, please see
  [these instructions](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md).

  There are two cases in which a change cannot be done in weblate and requires a
  PR:

  - A text may not be currently localisable. In this case, **adding a new
    language key** via `$t("languageKey")` might be necessary
  - language keys need to be **added to `en.json`** to be visible in weblate. If
    this has not happened, a PR is appreciated.
  - **Adding a new language** requires a new file see
    [these instructions](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md)

  <sub>Because maintainer time is precious, junior maintainers may merge
  uncontroversial PRs in this area.</sub>

  </p>
  </details>

- <details><summary><b>New Notification Providers</b> (click to expand)</summary>
  <p>

  To set up a new notification provider these files need to be modified/created:

  - `server/notification-providers/PROVIDER_NAME.js` is where the heart of the
    notification provider lives.

        - Both `monitorJSON` and `heartbeatJSON` can be `null` for some events. If

  both are `null`, this is a general testing message, but if just
  `heartbeatJSON` is `null` this is a certificate expiry.

        - Please wrap the axios call into a

  ```js
  try {
    let result = await axios.post(...);
    if (result.status === ...) ...
  } catch (error) {
    this.throwGeneralAxiosError(error);
  }
  ```

  - `server/notification.js` is where the backend of the notification provider
    needs to be registered. _If you have an idea how we can skip this step, we
    would love to hear about it ^^_

  - `src/components/NotificationDialog.vue` you need to decide if the provider
    is a regional or a global one and add it with a name to the respective list

  - `src/components/notifications/PROVIDER_NAME.vue` is where the frontend of
    each provider lives. Please make sure that you have:

        - used `HiddenInput` for secret credentials
        - included all the necessary helptexts/placeholder/.. to make sure the

  notification provider is simple to setup for new users. - include all
  translations (`{{ $t("Translation key") }}`,
  [`i18n-t keypath="Translation key">`](https://vue-i18n.intlify.dev/guide/advanced/component.html))
  in `src/lang/en.json` to enable our translators to translate this

  - `src/components/notifications/index.js` is where the frontend of the
    provider needs to be registered. _If you have an idea how we can skip this
    step, we would love to hear about it ^^_

  Offering notifications is close to the core of what we are as an uptime
  monitor. Therefore, making sure that they work is also really important.
  Because testing notification providers is quite time intensive, we mostly
  offload this onto the person contributing a notification provider.

  To make sure you have tested the notification provider, please include
  screenshots of the following events in the pull-request description:

  - `UP`/`DOWN`
  - Certificate Expiry via <https://expired.badssl.com/>
  - Testing (the test button on the notification provider setup page)

  <br/>

  Using the following way to format this is encouraged:

  ```md
  | Event              | Before                | After                |
  | ------------------ | --------------------- | -------------------- |
  | `UP`               | ![Before](image-link) | ![After](image-link) |
  | `DOWN`             | ![Before](image-link) | ![After](image-link) |
  | Certificate-expiry | ![Before](image-link) | ![After](image-link) |
  | Testing            | ![Before](image-link) | ![After](image-link) |
  ```

  <sub>Because maintainer time is precious, junior maintainers may merge
  uncontroversial PRs in this area.</sub>

  </p>
  </details>

- <details><summary><b>New Monitoring Types</b> (click to expand)</summary>
  <p>

  To set up a new notification provider these files need to be modified/created:

  - `server/monitor-types/MONITORING_TYPE.js` is the core of each monitor. the
    `async check(...)`-function should:

        - throw an error for each fault that is detected with an actionable error

  message - in the happy-path, you should set `heartbeat.msg` to a successful
  message and set `heartbeat.status = UP`

  - `server/uptime-kuma-server.js` is where the monitoring backend needs to be
    registered. _If you have an idea how we can skip this step, we would love to
    hear about it ^^_

  - `src/pages/EditMonitor.vue` is the shared frontend users interact with.
    Please make sure that you have: - used `HiddenInput` for secret
    credentials - included all the necessary helptexts/placeholder/.. to make
    sure the notification provider is simple to setup for new users. - include
    all translations (`{{ $t("Translation key") }}`,
    [`i18n-t keypath="Translation key">`](https://vue-i18n.intlify.dev/guide/advanced/component.html))
    in `src/lang/en.json` to enable our translators to translate this

  <sub>Because maintainer time is precious, junior maintainers may merge
  uncontroversial PRs in this area.</sub>

  </p>
  </details>

- <details><summary><b>New Features / Major Changes / Breaking Bugfixes</b> (click to expand)</summary>
  <p>

  be sure to **create an empty draft pull request or open an issue, so we can
  have a discussion first**. This is especially important for a large pull
  request or when you don't know if it will be merged or not.

  <sub>Because of the large impact of this work, only senior maintainers may
  merge PRs in this area. </sub>

  </p>
  </details>

- <details><summary><b>Pull Request Guidelines</b> (click to expand)</summary>
  <p>

  ## Steps to Submit a Pull Request

  1. **Fork** the [Uptime-Kuma repository].

  [Uptime-Kuma repository]: https://github.com/louislam/uptime-kuma/

  2. **Clone** your forked repository to your local machine.
  3. **Create a new branch** for your changes (e.g.,
     `feature/add-new-notification-provider-signal`).
  4. **Initiate a discussion before making major changes** by creating an empty
     commit:

     ```sh
     git commit -m "<YOUR TASK NAME>" --allow-empty
     ```

  5. **Push** your branch to your forked repository.
  6. **Open a pull request** using this link: [Compare & Pull Request].

  [Compare & Pull Request]: https://github.com/louislam/uptime-kuma/compare/

  7. **Select the correct source and target branches**.
  8. **Link to related issues** for context.
  9. **Provide a clear and concise description** explaining the changes and
     their purpose.

  - **Type of changes**

    - Bugfix (a non-breaking change that resolves an issue)
    - New feature (a non-breaking change that adds new functionality)
    - Breaking change (a fix or feature that alters existing functionality in a
      way that could cause issues)
    - User Interface (UI) updates
    - New Documentation (addition of new documentation)
    - Documentation Update (modification of existing documentation)
    - Documentation Update Required (the change requires updates to related
      documentation)
    - Other (please specify):
      - Provide additional details here.

  - **Checklist**

    - My code adheres to the style guidelines of this project.
    - I ran ESLint and other code linters for modified files.
    - I have reviewed and tested my code.
    - I have commented my code, especially in hard-to-understand areas (e.g.,
      using JSDoc for methods).
    - My changes generate no new warnings.
    - My code needed automated testing. I have added them (this is an optional
      task).
    - Documentation updates are included (if applicable).
    - I have considered potential security impacts and mitigated risks.
    - Dependency updates are listed and explained.
    - I have read and understood the
      [Pull Request guidelines](#recommended-pull-request-guideline).

  10. **When publishing your PR, set it as a** `Draft pull request` **to allow
      for review and prevent automatic merging.**
  11. **Maintainers will assign relevant labels** (e.g., `A:maintenance`,
      `A:notifications`).
  12. **Complete the PR checklist**, ensuring that:

      - Documentation is updated if necessary.
      - Tests are written or updated.
      - CI/CD checks pass successfully.

  13. **Request feedback** from team members to refine your changes before the
      final review.

  ## When Can You Change the PR Status to "Ready for Review"?

  A PR should remain in **draft status** until all tasks are completed. Only
  change the status to **Ready for Review** when:

  - You have implemented all planned changes.
  - You have addressed all feedback.
  - Your code is fully tested and ready for integration.
  - You have updated or created the necessary tests.
  - You have verified that CI/CD checks pass successfully.

  <br />

  A **work-in-progress (WIP) PR** must stay in **draft status** until everything
  is finalized.

  <sub>Since maintainer time is valuable, junior maintainers may merge
  uncontroversial PRs.</sub>

  </p>
  </details>

## The following rules are essential for making your PR mergable

- Merging multiple issues by a huge PR is more difficult to review and causes
  conflicts with other PRs. Please

  - (if possible) **create one PR for one issue** or
  - (if not possible) **explain which issues a PR addresses and why this PR
    should not be broken apart**

- Make sure your **PR passes our continuous integration**. PRs will not be
  merged unless all CI-Checks are green.
- **Breaking changes** (unless for a good reason and discussed beforehand) will
  not get merged / not get merged quickly. Such changes require a major version
  release.
- **Test your code** before submitting a PR. Buggy PRs will not be merged.
- Make sure the **UI/UX is close to Uptime Kuma**.
- **Think about the maintainability**: Don't add functionality that is
  completely **out of scope**. Keep in mind that we need to be able to maintain
  the functionality.
- Don't modify or delete existing logic without a valid reason.
- Don't convert existing code into other programming languages for no reason.

I ([@louislam](https://github.com/louislam)) have the final say. If your pull
request does not meet my expectations, I will reject it, no matter how much time
you spent on it. Therefore, it is essential to have a discussion beforehand.

I will assign your pull request to a [milestone], if I plan to review and merge
it.

[milestone]: https://github.com/louislam/uptime-kuma/milestones

Please don't rush or ask for an ETA. We have to understand the pull request,
make sure it has no breaking changes and stick to the vision of this project,
especially for large pull requests.

## I'd Like to Work on an Issue. How Do I Do That?

We have found that assigning people to issues is unnecessary management
overhead. Instead, a short comment stating that you want to work on an issue is
appreciated, as it saves time for other developers. If you encounter any
problems during development, feel free to leave a comment describing what you
are stuck on.

### Recommended Pull Request Guideline

Before jumping into coding, it's recommended to initiate a discussion by
creating an empty pull request. This approach allows us to align on the
direction and scope of the feature, ensuring it doesn't conflict with existing
or planned work. It also provides an opportunity to identify potential pitfalls
early on, helping to avoid issues down the line.

1. **Fork** the [Uptime-Kuma repository].
2. **Clone** your forked repository to your local machine.
3. **Create a new branch** for your changes (e.g.,
   `feature/add-new-notification-provider-signal`).
4. **Initiate a discussion before making major changes** by creating an empty
   commit:

   ```sh
   git commit -m "<YOUR TASK NAME>" --allow-empty
   ```

5. **Push** your branch to your forked repository.
6. **Open a pull request** using this link: [Compare & Pull Request].
7. **Select the correct source and target branches**.
8. **Link to related issues** for context.
9. **Provide a clear and concise description** explaining the changes and their
   purpose.

   - **Type of changes**

     - Bugfix (a non-breaking change that resolves an issue)
     - New feature (a non-breaking change that adds new functionality)
     - Breaking change (a fix or feature that alters existing functionality in a
       way that could cause issues)
     - User Interface (UI) updates
     - New Documentation (addition of new documentation)
     - Documentation Update (modification of existing documentation)
     - Documentation Update Required (the change requires updates to related
       documentation)
     - Other (please specify):
       - Provide additional details here.

   - **Checklist**

     - My code adheres to the style guidelines of this project.
     - I ran ESLint and other code linters for modified files.
     - I have reviewed and tested my code.
     - I have commented my code, especially in hard-to-understand areas (e.g.,
       using JSDoc for methods).
     - My changes generate no new warnings.
     - My code needed automated testing. I have added them (this is an optional
       task).
     - Documentation updates are included (if applicable).
     - I have considered potential security impacts and mitigated risks.
     - Dependency updates are listed and explained.
     - I have read and understood the
       [Pull Request guidelines](#recommended-pull-request-guideline).

10. **When publishing your PR, set it as a** `Draft pull request` **to allow for
    review and prevent automatic merging.**
11. **Maintainers will assign relevant labels** (e.g., `A:maintenance`,
    `A:notifications`).
12. **Complete the PR checklist**, ensuring that:

    - Documentation is updated if necessary.
    - Tests are written or updated.
    - CI/CD checks pass successfully.

13. **Request feedback** from team members to refine your changes before the
    final review.

### When Can You Change the PR Status to "Ready for Review"?

A PR should remain in **draft status** until all tasks are completed. Only
change the status to **Ready for Review** when:

- You have implemented all planned changes.
- You have addressed all feedback.
- Your code is fully tested and ready for integration.
- You have updated or created the necessary tests.
- You have verified that CI/CD checks pass successfully.

A **work-in-progress (WIP) PR** must stay in **draft status** until everything
is finalized.

## Project Styles

I personally do not like something that requires a lot of configuration before
you can finally start the app. The goal is to make the Uptime Kuma installation
as easy as installing a mobile app.

- Easy to install for non-Docker users

  - no native build dependency is needed (for `x86_64`/`armv7`/`arm64`)
  - no extra configuration and
  - no extra effort required to get it running

- Single container for Docker users

  - no complex docker-compose file
  - mapping the volume and exposing the port should be the only requirements

- Settings should be configurable in the frontend. Environment variables are
  discouraged, unless it is related to startup such as `DATA_DIR`
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

- [`Node.js`](https://nodejs.org/) >= 18
- [`npm`](https://www.npmjs.com/) >= 9.3
- [`git`](https://git-scm.com/)
- IDE that supports [`ESLint`](https://eslint.org/) and EditorConfig (I am using
  [`IntelliJ IDEA`](https://www.jetbrains.com/idea/))
- A SQLite GUI tool (f.ex.
  [`SQLite Expert Personal`](https://www.sqliteexpert.com/download.html) or
  [`DBeaver Community`](https://dbeaver.io/download/))

## Git Branches

- `master`: 2.X.X development. If you want to add a new feature, your pull
  request should base on this.
- `1.23.X`: 1.23.X development. If you want to fix a bug for v1 and v2, your
  pull request should base on this.
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

But sometimes you may want to restart the server without restarting the
frontend. In that case, you can run these commands in two terminals:

```bash
npm run start-frontend-dev
npm run start-server-dev
```

## Backend Server

It binds to `0.0.0.0:3001` by default.

The backend is an `express.js` server with `socket.io` integrated. It uses
`socket.io` to communicate with clients, and most server logic is encapsulated
in the `socket.io` handlers. `express.js` is also used to serve:

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
- `uptime-kuma-server.js` (UptimeKumaServer class, main logic should be here,
  but some still in `server.js`)

## Frontend Dev Server

It binds to `0.0.0.0:3000` by default. The frontend dev server is used for
development only.

For production, it is not used. It will be compiled to `dist` directory instead.

You can use Vue.js devtools Chrome extension for debugging.

### Build the frontend

```bash
npm run build
```

### Frontend Details

Uptime Kuma Frontend is a single page application (SPA). Most paths are handled
by Vue Router.

The router is in `src/router.js`

As you can see, most data in the frontend is stored at the root level, even
though you changed the current router to any other pages.

The data and socket logic are in `src/mixins/socket.js`.

## Database Migration

See: <https://github.com/louislam/uptime-kuma/tree/master/db/knex_migrations>

## Unit Test

```bash
npm run build
npm test
```

## Dependencies

Both frontend and backend share the same `package.json`. However, the frontend
dependencies are eventually not used in the production environment, because it
is usually also baked into `dist` files. So:

- Frontend dependencies = "devDependencies"
  - Examples: - `vue`, `chart.js`
- Backend dependencies = "dependencies"
  - Examples: `socket.io`, `sqlite3`
- Development dependencies = "devDependencies"
  - Examples: `eslint`, `sass`

### Update Dependencies

Since previously updating Vite 2.5.10 to 2.6.0 broke the application completely,
from now on, it should update the patch release version only.

Patch release = the third digit ([Semantic Versioning](https://semver.org/))

If for security / bug / other reasons, a library must be updated, breaking
changes need to be checked by the person proposing the change.

## Translations

Please add **all** the strings which are translatable to `src/lang/en.json` (if
translation keys are omitted, they can not be translated.)

**Don't include any other languages in your initial pull request** (even if this
is your mother tongue), to avoid merge-conflicts between weblate and `master`.
The translations can then (after merging a PR into `master`) be translated by
awesome people donating their language skills.

If you want to help by translating Uptime Kuma into your language, please visit
the [instructions on how to translate using weblate].

[instructions on how to translate using weblate]:
  https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md

## Spelling & Grammar

Feel free to correct the grammar in the documentation or code. My mother
language is not English and my grammar is not that great.

## Wiki

Since there is no way to make a pull request to the wiki, I have set up another
repo to do that.

<https://github.com/louislam/uptime-kuma-wiki>

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
<https://github.com/louislam/uptime-kuma/issues?q=sort%3Aupdated-desc>

### What is a maintainer and what are their roles?

This project has multiple maintainers who specialise in different areas.
Currently, there are 3 maintainers:

| Person            | Role              | Main Area        |
| ----------------- | ----------------- | ---------------- |
| `@louislam`       | senior maintainer | major features   |
| `@chakflying`     | junior maintainer | fixing bugs      |
| `@commanderstorm` | junior maintainer | issue-management |

### Procedures

We have a few procedures we follow. These are documented here:

- <details><summary><b>Set up a Docker Builder</b> (click to expand)</summary>
  <p>

  - amd64, armv7 using local.
  - arm64 using remote arm64 cpu, as the emulator is too slow and can no longer
    pass the `npm ci` command.

  1. Add the public key to the remote server.
  2. Add the remote context. The remote machine must be arm64 and installed
     Docker CE.

     ```bash
     docker context create oracle-arm64-jp --docker "host=ssh://root@100.107.174.88"
     ```

  3. Create a new builder.

     ```bash
     docker buildx create --name kuma-builder --platform linux/amd64,linux/arm/v7
     docker buildx use kuma-builder
     docker buildx inspect --bootstrap
     ```

  4. Append the remote context to the builder.

     ```bash
     docker buildx create --append --name kuma-builder --platform linux/arm64 oracle-arm64-jp
     ```

  5. Verify the builder and check if the builder is using `kuma-builder`.
     `docker buildx inspect kuma-builder docker buildx ls`

  </p>
  </details>

- <details><summary><b>Release</b> (click to expand)</summary>
  <p>

  1. Draft a release note
  2. Make sure the repo is cleared
  3. If the healthcheck is updated, remember to re-compile it:
     `npm run build-docker-builder-go`
  4. `npm run release-final` with env vars: `VERSION` and `GITHUB_TOKEN`
  5. Wait until the `Press any key to continue`
  6. `git push`
  7. Publish the release note as `1.X.X`
  8. Press any key to continue
  9. Deploy to the demo server: `npm run deploy-demo-server`

  These Items need to be checked:

  - [ ] Check all tags is fine on
        <https://hub.docker.com/r/louislam/uptime-kuma/tags>
  - [ ] Try the Docker image with tag 1.X.X (Clean install / amd64 / arm64 /
        armv7)
  - [ ] Try clean installation with Node.js

  </p>
  </details>

- <details><summary><b>Release Beta</b> (click to expand)</summary>
  <p>

  1. Draft a release note, check `This is a pre-release`
  2. Make sure the repo is cleared
  3. `npm run release-beta` with env vars: `VERSION` and `GITHUB_TOKEN`
  4. Wait until the `Press any key to continue`
  5. Publish the release note as `1.X.X-beta.X`
  6. Press any key to continue

  </p>
  </details>

- <details><summary><b>Release Wiki</b> (click to expand)</summary>
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

- <details><summary>Change the base of a pull request such as <code>master</code> to <code>1.23.X</code> (click to expand)</summary>
  <p>

  ```bash
  git rebase --onto <new parent> <old parent>
  ```

  </p>
  </details>
