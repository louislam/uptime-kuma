<div align="center" width="100%">
    <img src="./public/logo.png" width="128" alt="PSS Uptime Logo" />
</div>

# PSS Uptime

PSS Uptime is an easy-to-use self-hosted monitoring tool for the Marshall Islands Public School System.

> **Note:** This project is based on [Uptime Kuma](https://github.com/louislam/uptime-kuma), an open-source monitoring tool created by [louislam](https://github.com/louislam). We extend our gratitude to the Uptime Kuma project and its contributors for their excellent work.

<img src="https://user-images.githubusercontent.com/1336778/212262296-e6205815-ad62-488c-83ec-a5b0d0689f7c.jpg" width="700" alt="PSS Uptime Dashboard Screenshot" />

## 🥔 Live Demo

For a live demo of the original Uptime Kuma project, visit:

Demo Server (Location: Frankfurt - Germany): <https://demo.kuma.pet/start-demo>

It is a temporary live demo, all data will be deleted after 10 minutes. Sponsored by [Uptime Kuma Sponsors](https://github.com/louislam/uptime-kuma#%EF%B8%8F-sponsors).

## ⭐ Features

PSS Uptime includes all the powerful features from Uptime Kuma:

- Monitoring uptime for HTTP(s) / TCP / HTTP(s) Keyword / HTTP(s) Json Query / Websocket / Ping / DNS Record / Push / Steam Game Server / Docker Containers
- Fancy, Reactive, Fast UI/UX
- Notifications via Telegram, Discord, Gotify, Slack, Pushover, Email (SMTP), and [90+ notification services](https://github.com/louislam/uptime-kuma/tree/master/src/components/notifications)
- 20-second intervals
- [Multi Languages](https://github.com/louislam/uptime-kuma/tree/master/src/lang)
- Multiple status pages
- Map status pages to specific domains
- Ping chart
- Certificate info
- Proxy support
- 2FA support

## 🔧 How to Install

### 🐳 Docker Compose

```bash
git clone <your-repo-url>
cd PSS-Uptime
docker compose up -d --build
```

PSS Uptime is now running on all network interfaces (e.g. http://localhost:3001 or http://your-ip:3001).

> [!WARNING]
> File Systems like **NFS** (Network File System) are **NOT** supported. Please map to a local directory or volume.

### 🐳 Docker Command

```bash
docker build -t pss-uptime -f docker/dockerfile --target release .
docker run -d --restart=always -p 3001:3001 -v pss-uptime:/app/data --name pss-uptime pss-uptime
```

PSS Uptime is now running on all network interfaces (e.g. http://localhost:3001 or http://your-ip:3001).

If you want to limit exposure to localhost only:

```bash
docker run ... -p 127.0.0.1:3001:3001 ...
```

### 💪🏻 Non-Docker

Requirements:

- Platform
  - ✅ Major Linux distros such as Debian, Ubuntu, Fedora and ArchLinux etc.
  - ✅ Windows 10 (x64), Windows Server 2012 R2 (x64) or higher
  - ❌ FreeBSD / OpenBSD / NetBSD
  - ❌ Replit / Heroku
- [Node.js](https://nodejs.org/en/download/) >= 20.4
- [Git](https://git-scm.com/downloads)
- [pm2](https://pm2.keymetrics.io/) - For running PSS Uptime in the background

```bash
git clone <your-repo-url>
cd PSS-Uptime
npm run setup

# Option 1. Try it
node server/server.js

# (Recommended) Option 2. Run in the background using PM2
# Install PM2 if you don't have it:
npm install pm2 -g && pm2 install pm2-logrotate

# Start Server
pm2 start server/server.js --name pss-uptime
```

PSS Uptime is now running on all network interfaces (e.g. http://localhost:3001 or http://your-ip:3001).

More useful PM2 Commands

```bash
# If you want to see the current console output
pm2 monit

# If you want to add it to startup
pm2 startup && pm2 save
```

### Advanced Installation

If you need more options or need to browse via a reverse proxy, please refer to the original Uptime Kuma documentation:

<https://github.com/louislam/uptime-kuma/wiki/%F0%9F%94%A7-How-to-Install>

## 🆙 How to Update

For update instructions, please refer to the original Uptime Kuma documentation:

<https://github.com/louislam/uptime-kuma/wiki/%F0%9F%86%99-How-to-Update>

## 🆕 What's Next?

For the latest features and roadmap, please check the original Uptime Kuma project:

<https://github.com/louislam/uptime-kuma/milestones>

## ❤️ Credits & Acknowledgments

PSS Uptime is based on [Uptime Kuma](https://github.com/louislam/uptime-kuma), an excellent open-source monitoring tool created by [louislam](https://github.com/louislam) and maintained by a dedicated community of contributors.

We would like to express our gratitude to:
- [louislam](https://github.com/louislam) for creating and maintaining Uptime Kuma
- All contributors to the Uptime Kuma project
- The open-source community that makes projects like this possible

If you find PSS Uptime useful, please consider supporting the original Uptime Kuma project:
- [GitHub Sponsors](https://github.com/sponsors/louislam)
- [Open Collective](https://opencollective.com/uptime-kuma)

## 🖼 More Screenshots

Light Mode:

<img src="https://uptime.kuma.pet/img/light.jpg" width="512" alt="PSS Uptime Light Mode Screenshot of how the Dashboard looks" />

Status Page:

<img src="https://user-images.githubusercontent.com/1336778/134628766-a3fe0981-0926-4285-ab46-891a21c3e4cb.png" width="512" alt="PSS Uptime Status Page Screenshot" />

Settings Page:

<img src="https://louislam.net/uptimekuma/2.jpg" width="400" alt="PSS Uptime Settings Page Screenshot" />

Telegram Notification Sample:

<img src="https://louislam.net/uptimekuma/3.jpg" width="400" alt="PSS Uptime Telegram Notification Sample Screenshot" />

## About PSS Uptime

PSS Uptime is a customized version of Uptime Kuma for the Marshall Islands Public School System. This project maintains all the powerful features of the original Uptime Kuma while being tailored for the specific needs of the PSS organization.

### Original Uptime Kuma Motivation

The original Uptime Kuma project was created with the following motivations:
- A need for a self-hosted monitoring tool like "Uptime Robot"
- Building a fancy, modern UI
- Learning Vue 3 and vite.js
- Showcasing Bootstrap 5 capabilities
- Using WebSocket with SPA instead of REST API
- Deploying Docker images to Docker Hub

If you love this project, please consider:
- Giving the original [Uptime Kuma project](https://github.com/louislam/uptime-kuma) a ⭐
- Supporting the Uptime Kuma project through [GitHub Sponsors](https://github.com/sponsors/louislam) or [Open Collective](https://opencollective.com/uptime-kuma)

## 🗣️ Discussion / Ask for Help

For questions about PSS Uptime, please use the appropriate channels for this project.

For questions about the original Uptime Kuma project, please refer to:
- [Uptime Kuma GitHub Issues](https://github.com/louislam/uptime-kuma/issues)
- [Subreddit (r/UptimeKuma)](https://www.reddit.com/r/UptimeKuma/)

⚠️ For any general or technical questions about Uptime Kuma, please don't send emails to the original author, as they are unable to provide support in that manner.

## Contributions

### Contributing to PSS Uptime

Contributions to PSS Uptime are welcome! Please follow the project's contribution guidelines.

### Contributing to Uptime Kuma

If you'd like to contribute to the original Uptime Kuma project (which benefits this project as well), please refer to:

- [Uptime Kuma Contributing Guidelines](https://github.com/louislam/uptime-kuma/blob/master/CONTRIBUTING.md#can-i-create-a-pull-request-for-uptime-kuma)
- [Test Pull Requests](https://github.com/louislam/uptime-kuma/wiki/Test-Pull-Requests)
- [Latest Beta Releases](https://github.com/louislam/uptime-kuma/releases)
- [Report Bugs / Feature Requests](https://github.com/louislam/uptime-kuma/issues)
- [Translations](https://github.com/louislam/uptime-kuma/blob/master/src/lang/README.md)

## License

This project is based on Uptime Kuma and follows the same license. Please refer to the [LICENSE](LICENSE) file for details.
