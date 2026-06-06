# Upstream merge notes: 06/06/2026

## Summary

Merged `louislam/master` (2.4.0) into local branch
`Krao/pm2-system-service-platform` on 06/06/2026 kl. 23:29.

- Upstream HEAD before merge: `a7725149` (06/06/2026)
- Local HEAD before merge: `0a83a3e3`
- Merge commit (local): `42730edf`
- Uptime Kuma version: **2.3.2 -> 2.4.0**

## Commits pulled in (26 since `b829329e`)

| SHA      | Type  | Description                                        |
| -------- | ----- | -------------------------------------------------- |
| 8ad9ab64 | fix   | npm 11.16.0 handling                               |
| 09f43d3e | fix   | Let's Encrypt Gen Y root certs (docker-only)       |
| 9f3b837c | chore | Version bump to 2.4.0                              |
| d0a63d56 | fix   | Globalping ping monitor protocol preservation      |
| 8e27fd19 | fix   | Kafka producer timeout                             |
| 2372d39b | chore | GitHub workflow: auto PR title for translation PRs |
| a7725149 | chore | Code formatting                                    |
| + 19     | chore | Weblate translation updates (incl. nb-NO)          |

## DB schema changes

None. No new knex migrations in the 2.4.0 delta.

## Conflicts during merge

None. Auto-merge completed cleanly on all four overlap files:

- `server/model/monitor.js`
- `server/util-server.js`
- `src/lang/en.json`
- `src/pages/EditMonitor.vue`

## Fork-only files preserved (verified)

- `server/monitor-types/pm2.js`
- `server/monitor-types/system-service.js`
- `server/util/pm2.js`
- `server/modules/webhook-pipeline-metrics.js`
- `src/components/WebhookPipelineMetrics.vue`
- `modules/pm2-kuma-push-sync.js`
- `.htaccess`
- `ecosystem.config.js`
- `sql/add-tags.sql`, `sql/backup-before-tags-20260525-041107.sql`
- All `to-do/FIX-*.md` and prior merge notes

## Build and restart

- `npm ci`: success (~7 min)
- `npm run build` (vite): success in ~136 s, dist hash `index-Dzb-JxNr.js`
- `chown -R newst3922:newst3922 dist/`
- `pm2 restart status-uptime-kuma --update-env`: success
- `kuma-pm2-push-sync`: untouched (no restart needed)
- Boot took about 90 s (RDAP refresh + UptimeCalculator pre-warm)

## Health check

| Endpoint                                                     | HTTP | Notes                 |
| ------------------------------------------------------------ | ---- | --------------------- |
| `http://127.0.0.1:3011/`                                     | 302  | 43 ms                 |
| `https://status.newstargeted.com/status/newstargeted-status` | 200  | 4.7 s                 |
| `http://127.0.0.1:3011/status/newstargeted-status/rss`       | 200  | `application/rss+xml` |
| `http://127.0.0.1:3011/api/status-page/webhook-pipeline`     | 200  | 0.23 s                |

CSP header on `/`: `frame-ancestors 'self' https://newstargeted.com
https://www.newstargeted.com` (embed CSP intact).

PM2 reports `status-uptime-kuma` version **2.4.0**.

## Backup taken before merge

Location: `/home/backup/status.newstargeted.com-20260606-232928-pre-merge-240/`

| File                                   | Size  |
| -------------------------------------- | ----- |
| `status.newstargeted.com-files.tar.gz` | 68 M  |
| `news_status.sql.gz`                   | 2.8 M |

## What was NOT done

- No manual schema changes (none required).
- No `kuma-pm2-push-sync` restart.
- No project-root CHANGELOG (fork has none).
- No Discord changelog announcement (not registered in Changelog-Announcement).
