# Uptime Kuma

<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="" />
</div>

It is a self-hosted monitoring tool like "Uptime Robot".

# Features

* Monitoring uptime for HTTP(s) / TCP / Ping.
* Fancy, Reactive, Fast UI/UX.
* Notifications via Webhook, Telegram, Discord and email (SMTP). 
* 20 seconds interval.

# How to Use

### Docker
```
docker run -d --restart=always -p 3001:3001 louislam/uptime-kuma
```

Browse to http://localhost:3001 after started.

### Node.js >= 14 + GIT
```
git clone git@github.com:louislam/uptime-kuma.git
cd uptime-kuma
npm run install

# 1. Try it
npm run start-server

# 2. Run in background using PM2
# Install PM2 if you don't have: npm install pm2 -g
pm2 start npm -- run start-server

```

Browse to http://localhost:3001 after started.

### One-click Deploy to DigitalOcean

Coming Soon

# Motivation

* I was looking for a self-hosted monitoring tool like "Uptime Robot", but it is hard to find a suitable one. One of the close one is statping. Unfortunately, it is not stable and unmaintained. 
* Want to build a fancy UI.
* Learn Vue 3 and vite.js.
* Show the power of Bootstrap 5. 
* Try to use WebSocket with SPA instead of REST API.
* Deploy my first Docker image to Docker Hub.


If you love this project, please consider giving me a ⭐.

