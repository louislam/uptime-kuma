# Uptime Kuma

<a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/stars/louislam/uptime-kuma" /></a> <a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/pulls/louislam/uptime-kuma" /></a> <a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/v/louislam/uptime-kuma/latest?label=docker%20image%20ver." /></a> <a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/last-commit/louislam/uptime-kuma" /></a>


<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="" />
</div>

It is a self-hosted monitoring tool like "Uptime Robot".

<img src="https://louislam.net/uptimekuma/1.jpg" width="512" alt="" />

# Features

* Monitoring uptime for HTTP(s) / TCP / Ping.
* Fancy, Reactive, Fast UI/UX.
* Notifications via Webhook, Telegram, Discord and email (SMTP). 
* 20 seconds interval.

# How to Use

### Docker

⚠ For someone, who are using Raspberry Pi 3<=, please keep using 1.0.1.

```bash
# Create a volume
docker volume create uptime-kuma

# Start the container
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma
```

Browse to http://localhost:3001 after started.

Change Port and Volume

```bash
docker run -d --restart=always -p <YOUR_PORT>:3001 -v <YOUR_DIR OR VOLUME>:/app/data --name uptime-kuma louislam/uptime-kuma
```

### Without Docker

Required Tools: Node.js >= 14, git and pm2. 

```bash
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
npm run setup

# Option 1. Try it
npm run start-server

# (Recommended) 
# Option 2. Run in background using PM2
# Install PM2 if you don't have: npm install pm2 -g
pm2 start npm --name uptime-kuma -- run start-server

# Listen to different port or hostname
pm2 start npm --name uptime-kuma -- run start-server -- --port=80 --hostname=0.0.0.0

```

Browse to http://localhost:3001 after started.

### One-click Deploy to DigitalOcean

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/louislam/uptime-kuma/tree/master&refcode=e2c7eb658434)

Choose Cheapest Plan is enough. (US$ 5)

# How to Update

### Docker

Re-pull the latest docker image and create another container with the same volume.

PS: For every new release, it takes some time to build the docker image, please be patient if it is not available yet.

### Without Docker

```bash
git fetch --all
git checkout 1.0.3 --force
npm install
npm run build
pm2 restart uptime-kuma
```

# More Screenshots

Settings Page:

<img src="https://louislam.net/uptimekuma/2.jpg" width="400" alt="" />

Telegram Notification Sample:

<img src="https://louislam.net/uptimekuma/3.jpg" width="400" alt="" />


# Motivation

* I was looking for a self-hosted monitoring tool like "Uptime Robot", but it is hard to find a suitable one. One of the close one is statping. Unfortunately, it is not stable and unmaintained. 
* Want to build a fancy UI.
* Learn Vue 3 and vite.js.
* Show the power of Bootstrap 5. 
* Try to use WebSocket with SPA instead of REST API.
* Deploy my first Docker image to Docker Hub.


If you love this project, please consider giving me a ⭐.

