# Project Info

First of all, thank you everyone who made pull requests for Uptime Kuma, I never thought GitHub Community can be that nice! And also because of this, I also never thought other people actually read my code and edit my code. It is not structed and commented so well, lol. Sorry about that.

The project was created with vite.js (vue3). Then I created a sub-directory called "server" for server part. Both frontend and backend share the same package.json. 

The frontend code build into "dist" directory. The server uses "dist" as root. This is how production is working.

Your IDE should follow the config in ".editorconfig". The most special thing is I set it to 4 spaces indentation. I know 2 spaces indentation became a kind of standard nowadays for js, but my eyes is not so comfortable for this. In my opinion, there is no callback-hell nowadays, it is good to go back 4 spaces world again.

# Project Styles

I personally do not like something need to learn so much and need to config so much before you can finally start the app. 

For example, recently, because I am not a python expert, I spent a 2 hours to resolve all problems in order to install and use the Apprise cli. Apprise requires so many hidden requirements, I have to figure out myself how to solve the problems by Google search for my OS. That is painful. I do not want Uptime Kuma to be like this way, so:  

- Easy to install for non-Docker users, no native build dependency is needed (at least for x86_64), no extra config, no extra effort to get it run
- Single container for Docker users, no very complex docker-composer file. Just map the volume and expose the port, then good to go
- All settings in frontend.
- Easy to use

# Tools
- Node.js >= 14
- Git
- IDE that supports .editorconfig  (I am using Intellji Idea)
- A SQLite tool (I am using SQLite Expert Personal)

# Prepare the dev

```bash
npm install
```

# Backend Dev

```bash
npm run start-server

# Or 

node server/server.js

```

It binds to 0.0.0.0:3001 by default.


## Backend Details

It is mainly a socket.io app + express.js.

express.js is just used for serving the frontend built files (index.html, .js and .css etc.) 

# Frontend Dev

Start frontend dev server. Hot-reload enabled in this way. It binds to 0.0.0.0:3000.

```bash
npm run dev
```

PS: You can ignore those scss warnings, those warnings are from Bootstrap that I cannot fix.

You can use Vue Devtool Chrome extension for debugging.

After the frontend server started. It cannot connect to the websocket server even you have started the server. You need to tell the frontend that is a dev env by running this in DevTool console and refresh:

```javascript
localStorage.dev = "dev";
```

So that the frontend will try to connect websocket server in 3001.

Alternately, you can specific NODE_ENV to "development".


## Build the frontend

```bash
npm run build
```

## Frontend Details

Uptime Kuma Frontend is a single page application (SPA). Most paths are handled by Vue Router.

The router in "src/main.js"

As you can see, most data in frontend is stored in root level, even though you changed the current router to any other pages.

The data and socket logic in "src/mixins/socket.js"

# Database Migration

TODO

# Unit Test

Yes, no unit test for now. I know it is very important, but at the same time my spare time is very limited. I want to implement my ideas first. I will go back to this in some points.



  

