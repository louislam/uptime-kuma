<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="Uptime Panda Logo" />
</div>

# Uptime Panda

Uptime Panda is a self-hosted uptime monitoring tool — a fork of [Uptime Kuma](https://github.com/louislam/uptime-kuma) that adds a real ORM layer (Objection.js + Knex) and PostgreSQL as a first-class database backend, alongside SQLite and MariaDB/MySQL.

> 🐼 **What's the difference?** Functionally a superset of upstream. Same features, same look, plus PostgreSQL support, snake_case column reads end-to-end, and a Dialect-strategy DB layer. See [`docs/DATABASE.md`](docs/DATABASE.md).
>
> 🐻 **Where credit's due.** All the original work is by [@louislam](https://github.com/louislam) and the upstream Uptime Kuma contributors. Uptime Panda is a downstream fork — bug reports about features that exist upstream should go there too.

<a target="_blank" href="https://github.com/lleirborras/uptime-panda"><img src="https://img.shields.io/github/stars/lleirborras/uptime-panda?style=flat" /></a> <a target="_blank" href="https://github.com/lleirborras/uptime-panda"><img src="https://img.shields.io/github/last-commit/lleirborras/uptime-panda" /></a>

<img src="https://user-images.githubusercontent.com/1336778/212262296-e6205815-ad62-488c-83ec-a5b0d0689f7c.jpg" width="700" alt="Uptime Panda Dashboard Screenshot" />

## 🐼 Why a fork?

This fork exists for two reasons:

1. **Faster development cadence.** Upstream is large, popular, and intentionally cautious about merging changes — bigger features and architectural cleanups can sit in review for months. Uptime Panda lets us ship those changes immediately to the people who need them, then upstream them piecemeal at upstream's pace where appropriate.
2. **Faster feature acquisition.** PostgreSQL support, the Objection.js + Knex ORM rewrite, the Dialect-strategy database layer, the cross-dialect integration test suite, the Node 24 docker base, and the rebuild-from-source dev compose all shipped here weeks before they could realistically land upstream. If you need any of those today, this fork is for you.

If you don't need the PG/ORM-level changes and you're happy on upstream's release cadence, **use upstream** — it's the canonical project and we recommend it. Uptime Panda is for users who specifically want the divergent features above and don't mind running a less-traveled fork.

## 🥔 Live Demo

Upstream's hosted demo (same UI):

Demo Server (Location: Frankfurt - Germany): <https://demo.kuma.pet/start-demo>

It is a temporary live demo, all data will be deleted after 10 minutes.

## ⭐ Features

- Monitoring uptime for HTTP(s) / TCP / HTTP(s) Keyword / HTTP(s) Json Query / Websocket / Ping / DNS Record / Push / Steam Game Server / Docker Containers
- Fancy, Reactive, Fast UI/UX
- Notifications via Telegram, Discord, Gotify, Slack, Pushover, Email (SMTP), and 90+ other notification services (see `src/components/notifications/`)
- 20-second intervals
- Multi Languages (see `src/lang/`)
- Multiple status pages
- Map status pages to specific domains
- Ping chart
- Certificate info
- Proxy support
- 2FA support
- **Database backends:** SQLite (default), MariaDB/MySQL, PostgreSQL — see [`docs/DATABASE.md`](docs/DATABASE.md)

## 🔧 How to Install

### 🐳 Docker Compose

```bash
mkdir uptime-panda
cd uptime-panda
curl -o compose.yaml https://raw.githubusercontent.com/lleirborras/uptime-panda/master/compose.yaml
docker compose up -d
```

Uptime Panda runs on all network interfaces (e.g. `http://localhost:3001` or `http://your-ip:3001`).

For an external database, replace `compose.yaml` with [`compose.mariadb.yaml`](compose.mariadb.yaml) or [`compose.postgres.yaml`](compose.postgres.yaml).

> [!WARNING]
> File systems like **NFS** (Network File System) are **NOT** supported. Map to a local directory or volume.

### 💪🏻 Non-Docker

Requirements:

- Platform
  - ✅ Major Linux distros (Debian, Ubuntu, Fedora, Arch, …)
  - ✅ Windows 10 (x64), Windows Server 2012 R2 (x64) or higher
  - ❌ FreeBSD / OpenBSD / NetBSD
  - ❌ Replit / Heroku
- [Node.js](https://nodejs.org/en/download/) >= 20.4 (24 LTS recommended)
- [Git](https://git-scm.com/downloads)
- [pm2](https://pm2.keymetrics.io/) — for running in the background

```bash
git clone https://github.com/lleirborras/uptime-panda.git
cd uptime-panda
npm ci
npm run build

# Option 1. One-shot
node server/server.js

# Option 2. Background with PM2
npm install pm2 -g && pm2 install pm2-logrotate
pm2 start server/server.js --name uptime-panda
pm2 startup && pm2 save
```

### Advanced Installation / Reverse proxy / Updates

The bulk of the install / reverse-proxy / update guidance still applies from upstream's wiki. Use these as references; substitute `lleirborras/uptime-panda` for `louislam/uptime-kuma` in any URLs:

- [Install guide (upstream wiki)](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install)
- [Update guide (upstream wiki)](https://github.com/louislam/uptime-kuma/wiki/%F0%9F%86%99-How-to-Update)

## 🆕 What's Next?

Roadmap and active issues for the fork: <https://github.com/lleirborras/uptime-panda/issues>

For long-running upstream features the fork hasn't picked up yet, see [upstream milestones](https://github.com/louislam/uptime-kuma/milestones).

## 🖼 More Screenshots

Light Mode:

<img src="https://uptime.kuma.pet/img/light.jpg" width="512" alt="Uptime Panda Light Mode Dashboard Screenshot" />

Status Page:

<img src="https://user-images.githubusercontent.com/1336778/134628766-a3fe0981-0926-4285-ab46-891a21c3e4cb.png" width="512" alt="Uptime Panda Status Page Screenshot" />

## 🗣️ Discussion / Ask for Help

For **fork-specific** questions (anything to do with the PostgreSQL backend, the ORM layer, the Dialect strategy, the integration tests, the rebuild-from-source dev compose):

- [GitHub Issues on this fork](https://github.com/lleirborras/uptime-panda/issues)

For **everything else** (general usage, UI questions, monitor-type questions, notification providers — anything that exists upstream too), upstream is the canonical place:

- [Upstream GitHub Issues](https://github.com/louislam/uptime-kuma/issues)
- [Subreddit r/UptimeKuma](https://www.reddit.com/r/UptimeKuma/)

## Contributions

### Pull Requests

PRs welcome on [the fork](https://github.com/lleirborras/uptime-panda/pulls). For changes that are equally relevant upstream (bug fixes, generic improvements, new monitor types) please consider also opening the PR upstream — the fork should not be a place where good general-purpose work gets stranded.

### Bug Reports / Feature Requests

- Fork-specific bugs: [open an issue here](https://github.com/lleirborras/uptime-panda/issues)
- Anything that reproduces on upstream Uptime Kuma: [open it upstream](https://github.com/louislam/uptime-kuma/issues) — we'll pick up the fix when it lands

### Translations

i18n still flows through upstream's Weblate, since the translation pool is shared:

<https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md>
