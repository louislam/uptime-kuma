<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="Uptime Kuma Logo" />
</div>

# Uptime Kuma

Uptime Kuma is an easy-to-use self-hosted monitoring tool.

<a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/stars/louislam/uptime-kuma?style=flat" /></a>
<a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/pulls/louislam/uptime-kuma" /></a>
<a target="_blank" href="https://hub.docker.com/r/louislam/uptime-kuma"><img src="https://img.shields.io/docker/v/louislam/uptime-kuma/2?label=docker%20image%20ver." /></a>
<a target="_blank" href="https://github.com/louislam/uptime-kuma"><img src="https://img.shields.io/github/last-commit/louislam/uptime-kuma" /></a>
<a target="_blank" href="https://opencollective.com/uptime-kuma"><img src="https://opencollective.com/uptime-kuma/total/badge.svg?label=Open%20Collective%20Backers&color=brightgreen" /></a>
[![GitHub Sponsors](https://img.shields.io/github/sponsors/louislam?label=GitHub%20Sponsors)](https://github.com/sponsors/louislam)
<a href="https://weblate.kuma.pet/projects/uptime-kuma/uptime-kuma/">
<img src="https://weblate.kuma.pet/widgets/uptime-kuma/-/svg-badge.svg" alt="Translation status" />
</a>

<img src="https://user-images.githubusercontent.com/1336778/212262296-e6205815-ad62-488c-83ec-a5b0d0689f7c.jpg" width="700" alt="Uptime Kuma Dashboard Screenshot" />

## Live Demo

Try it!

Demo Server (Frankfurt, Germany): <https://demo.kuma.pet/start-demo>

**Note:** This is a temporary demo. All data will be deleted after 10 minutes.

## Features

- Monitoring uptime for HTTP(s), TCP, HTTP(s) Keyword, HTTP(s) JSON Query, WebSocket, Ping, DNS Record, Push, Steam Game Server, Docker Containers.
- Modern, reactive, fast UI/UX.
- Notifications via Telegram, Discord, Gotify, Slack, Pushover, Email (SMTP), and 90+ other services.
- 20-second check intervals.
- Multi-language support.
- Multiple status pages with custom domain mapping.
- Ping charts and certificate information.
- Proxy and 2FA support.

## How to Install

### Docker Compose (Recommended)

```bash
mkdir uptime-kuma
cd uptime-kuma
curl -o compose.yaml https://raw.githubusercontent.com/louislam/uptime-kuma/master/compose.yaml
docker compose up -d
```

Uptime Kuma will be available at `http://localhost:3001` or `http://your-server-ip:3001`.

> **Warning:** Network file systems such as NFS are not supported. Use a local directory or Docker volume.

### Docker Command

```bash
docker run -d --restart=always -p 3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:2
```

Uptime Kuma will be available at `http://localhost:3001` or `http://your-server-ip:3001`.

**Localhost only:**
```bash
docker run -d --restart=always -p 127.0.0.1:3001:3001 -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:2
```

### Non-Docker

**Requirements:**
- Node.js >= 20.4
- Git
- pm2 (recommended for production)

Supported platforms:
- Major Linux distributions (Debian, Ubuntu, Fedora, Arch Linux, etc.)
- Windows 10 (x64) / Windows Server 2012 R2 (x64) or higher

```bash
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
npm run setup
```

**Run options:**

```bash
# Development mode
node server/server.js
```

```bash
# Production (recommended)
npm install -g pm2
pm2 install pm2-logrotate
pm2 start server/server.js --name uptime-kuma
pm2 startup && pm2 save
```

**Useful PM2 commands:**
```bash
pm2 monit
pm2 restart uptime-kuma
pm2 logs uptime-kuma
```

### Advanced Installation

For reverse proxy setup, environment variables, and more options, see the [wiki](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install).

## How to Update

See the [wiki](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%86%99-How-to-Update).

## Migration from v1 to v2

See the detailed guide: [Migration From v1 To v2](https://github.com/louislam/uptime-kuma/wiki/Migration-From-v1-To-v2)

**Important:** Always back up your data directory before migrating.

## What's Next?

See the current milestones: <https://github.com/louislam/uptime-kuma/milestones>

## Sponsors

Thank you to all sponsors!

<img src="https://uptime.kuma.pet/sponsors?v=6" alt="Uptime Kuma Sponsors" />

## More Screenshots

**Light Mode:**
<img src="https://uptime.kuma.pet/img/light.jpg" width="512" alt="Uptime Kuma Light Mode Screenshot" />

**Status Page:**
<img src="https://user-images.githubusercontent.com/1336778/134628766-a3fe0981-0926-4285-ab46-891a21c3e4cb.png" width="512" alt="Uptime Kuma Status Page Screenshot" />

**Settings Page:**
<img src="https://louislam.net/uptimekuma/2.jpg" width="400" alt="Uptime Kuma Settings Page Screenshot" />

**Telegram Notification:**
<img src="https://louislam.net/uptimekuma/3.jpg" width="400" alt="Uptime Kuma Telegram Notification Sample" />

## Motivation

- Self-hosted alternative to Uptime Robot with a modern UI.
- Built with Vue 3, Vite, Bootstrap 5, and WebSocket.
- First Docker image deployment.

If you like this project, please star it ⭐.

## Discussion / Help

For questions, use:
- [GitHub Issues](https://github.com/louislam/uptime-kuma/issues)
- [r/UptimeKuma](https://www.reddit.com/r/UptimeKuma/)

## Contributions

- Pull requests: Follow [CONTRIBUTING.md](CONTRIBUTING.md).
- Translations: See [Weblate](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md).
- Spelling and grammar fixes in documentation and code are welcome.
