# Project Info

First of all, thank you everyone who made pull requests for Uptime Kuma, I never thought GitHub Community can be that nice! And also because of this, I also never thought other people actually read my code and edit my code. It is not structed and commented so well, lol. Sorry about that.

The project was created with vite.js (vue3). Then I created a sub-directory called "server" for server part. Both frontend and backend share the same package.json.

The frontend code build into "dist" directory. The server (express.js) exposes the "dist" directory as root of the endpoint. This is how production is working.

# Key Technical Skills

- Node.js (You should know what are promise, async/await and arrow function etc.)
- Socket.io
- SCSS
- Vue.js
- Bootstrap
- SQLite

# Directories

- data (App data)
- dist (Frontend build)
- extra (Extra useful scripts)
- public (Frontend resources for dev only)
- server (Server source code)
- src (Frontend source code)
- test (unit test)

# Can I create a pull request for Uptime Kuma?

Generally, if the pull request is working fine and it do not affect any existing logic, workflow and perfomance, I will merge into the master branch once it is tested.

If you are not sure, feel free to create an empty pull request draft first.

## Pull Request Examples

### ✅ High - Medium Priority

- Add a new notification
- Add a chart
- Fix a bug

### *️⃣ Requires one more reviewer

I do not have such knowledge to test it.

- Add k8s supports

### *️⃣ Low Priority

It changed my current workflow and require further studies.

- Change my release approach

### ❌ Won't Merge

- Duplicated pull request
- Buggy
- Existing logic is completely modified or deleted
- A function that is completely out of scope

# Project Styles

I personally do not like something need to learn so much and need to config so much before you can finally start the app.

- Easy to install for non-Docker users, no native build dependency is needed (at least for x86_64), no extra config, no extra effort to get it run
- Single container for Docker users, no very complex docker-composer file. Just map the volume and expose the port, then good to go
- Settings should be configurable in the frontend. Env var is not encouraged.
- Easy to use

# Coding Styles

- 4 spaces indentation
- Follow `.editorconfig`
- Follow ESLint

## Name convention

- Javascript/Typescript: camelCaseType
- SQLite: underscore_type
- CSS/SCSS: dash-type

# Tools

- Node.js >= 14
- Git
- IDE that supports ESLint and EditorConfig (I am using Intellji Idea)
- A SQLite tool (SQLite Expert Personal is suggested)

# Install dependencies

```bash
npm ci
```

# How to start the Backend Dev Server

(2021-09-23 Update)

```bash
npm run start-server-dev
```

It binds to `0.0.0.0:3001` by default.

## Backend Details

It is mainly a socket.io app + express.js.

express.js is just used for serving the frontend built files (index.html, .js and .css etc.)

- model/ (Object model, auto mapping to the database table name)
- modules/ (Modified 3rd-party modules)
- notification-providers/ (indivdual notification logic)
- routers/ (Express Routers)
- scoket-handler (Socket.io Handlers)
- server.js (Server main logic)

# How to start the Frontend Dev Server

1. Set the env var `NODE_ENV` to "development".
2. Start the frontend dev server by the following command.
   ```bash
   npm run dev
   ```
   It binds to `0.0.0.0:3000` by default.

You can use Vue.js devtools Chrome extension for debugging.

## Build the frontend

```bash
npm run build
```

## Frontend Details

Uptime Kuma Frontend is a single page application (SPA). Most paths are handled by Vue Router.

The router is in `src/router.js`

As you can see, most data in frontend is stored in root level, even though you changed the current router to any other pages.

The data and socket logic are in `src/mixins/socket.js`.


# Database Migration

1. Create `patch-{name}.sql` in `./db/`
2. Add your patch filename in the `patchList` list in `./server/database.js`

# Unit Test

Yes, no unit test for now. I know it is very important, but at the same time my spare time is very limited. I want to implement my ideas first. I will go back to this in some points.
