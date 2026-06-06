# Upstream merge notes: 25/05/2026 (evening)

## Summary

Second `louislam/master` merge of the day, applied to local branch
`Krao/pm2-system-service-platform` on 25/05/2026 kl. 19:13.

- Upstream HEAD before merge: `6a10d82f` (23/05/2026)
- Upstream HEAD after merge: `b829329e` (25/05/2026)
- Local HEAD before merge: `febfc951`
- Merge commit (local): `0762fbee`
- Pushed to: `master3395/master` (fast-forward `febfc951..0762fbee`)
- Uptime Kuma version: still `2.3.2` (no version bump upstream)

## Commits pulled in (6)

| SHA      | Date       | Type  | Description                                                 |
| -------- | ---------- | ----- | ----------------------------------------------------------- |
| 68d87cae | 25/05/2026 | feat  | Adding bearer token (#7415) - HTTP/Globalping monitors      |
| 68787405 | 25/05/2026 | chore | dev data directory handling for non-master branches (#7432) |
| 14d07ec3 | 25/05/2026 | fix   | bearer token support on WebSocket upgrade monitor (#7431)   |
| d5d727cd | 25/05/2026 | feat  | EgoSMS notification provider for Uganda (#7434)             |
| efa194a6 | 25/05/2026 | feat  | optional token field for gamedig monitors (#7433)           |
| b829329e | 25/05/2026 | feat  | incidents in RSS feed (#7420)                               |

## DB schema changes

Two new knex migrations applied automatically when Kuma restarted:

- `db/knex_migrations/2026-05-20-0000-add-bearer-token.js`: adds
  nullable `monitor.bearer_token` (TEXT).
- `db/knex_migrations/2026-05-25-0000-add-gamedig-token.js`: adds
  nullable `monitor.gamedig_token` (TEXT).

Verified post-restart with `SHOW COLUMNS FROM monitor LIKE ...`:
both columns are present, batch 2 in `knex_migrations`.

## Conflicts during merge

None. Auto-merge completed cleanly. Five files were touched on both
sides and resolved by line-level auto-merge:

- `server/model/monitor.js` (upstream `bearer_token` / `gamedigToken`
  fields kept alongside our PM2 monitor wiring)
- `server/model/status_page.js` (upstream RSS incident feed kept
  alongside our `reloadIndexHTMLIfChanged()` + `setSpaShellCacheHeaders()`
  - try/catch error handler)
- `server/server.js` (upstream `bean.bearer_token` / `bean.gamedigToken`
  kept alongside our `frame-ancestors` CSP and SPA shell hot-reload)
- `src/lang/en.json` (new EgoSMS / bearer / gamedig keys)
- `src/pages/EditMonitor.vue` (bearer + gamedig token inputs)

## Fork-only files preserved through the merge (verified)

- `server/monitor-types/pm2.js`
- `server/monitor-types/system-service.js`
- `server/util/pm2.js`
- `server/modules/webhook-pipeline-metrics.js`
- `src/components/WebhookPipelineMetrics.vue`
- `modules/pm2-kuma-push-sync.js`
- `.htaccess`
- `ecosystem.config.js` (PM2 app `status-uptime-kuma`, port 3011)
- `sql/add-tags.sql`, `sql/backup-before-tags-20260525-041107.sql`
- `to-do/MERGE-NOTES-20260525.md` (the morning's merge notes)

## Build and restart

- `npm run build` (vite): success in 173 s, dist hash `index-Ca3fcb4M.js`
- `chown -R newst3922:newst3922 dist/` (npm ran as root)
- `pm2 restart status-uptime-kuma --update-env`: success
- Boot took about 90 s (module load + knex migrations + RDAP refresh)
- `kuma-pm2-push-sync`: untouched (no restart needed)
- File ownership normalized post-merge: 114 files were briefly root-owned
  after `git merge` (run as root), all reset to `newst3922:newst3922`.

## Health check

| Endpoint                                                              | HTTP | Time                                |
| --------------------------------------------------------------------- | ---- | ----------------------------------- |
| `http://127.0.0.1:3011/`                                              | 302  | 12 ms                               |
| `http://127.0.0.1:3011/status/newstargeted-status`                    | 200  | 42 ms (warm)                        |
| `https://status.newstargeted.com/status/newstargeted-status`          | 200  | 1.1 s                               |
| `http://127.0.0.1:3011/api/status-page/heartbeat/newstargeted-status` | 200  | 17.9 s (cold), cached after         |
| `http://127.0.0.1:3011/api/status-page/newstargeted-status`           | 200  | 24.2 s (cold), cached after         |
| `http://127.0.0.1:3011/api/status-page/webhook-pipeline`              | 200  | 0.6 s                               |
| `http://127.0.0.1:3011/status/newstargeted-status/rss` (NEW)          | 200  | 20.9 s (cold) `application/rss+xml` |

CSP header on `/`: `frame-ancestors 'self' https://newstargeted.com
https://www.newstargeted.com` (our embed CSP intact).

## Pre-existing issues (not regressions)

- `Duplicate entry 'X-NNNNNNNN' for key 'stat_minutely_monitor_id_timestamp_unique'`
  errors continue. They were present before the merge and are caused by
  rapid PM2 push monitor heartbeats from `kuma-pm2-push-sync` racing on
  the `stat_minutely` insert. Upstream issue, not introduced by us.
- Cold-start API queries are 17-24 seconds because of large monitor
  count + group fan-out. Mitigated by the `apicache("5 minutes")` layer.

## Backup taken before merge

Location: `/home/backup/status.newstargeted.com-20260525-190444-pre-merge-evening/`

| File                                   | Size  | SHA-256 (prefix)           |
| -------------------------------------- | ----- | -------------------------- |
| `status.newstargeted.com-files.tar.gz` | 42 M  | `152826875c25ae97`         |
| `news_status.sql.gz`                   | 2.3 M | `d39de57bc6620f49`         |
| `BACKUP-README.txt`                    | -     | (manifest + restore steps) |

The tarball excludes `node_modules/`, `dist/`, and `data/error.log`.
The DB dump is a full `mariadb-dump --single-transaction --routines
--triggers --events news_status`. Restore steps are in `BACKUP-README.txt`.

## What was NOT done

- No `npm ci` (upstream did not change `package.json` /
  `package-lock.json`).
- No manual schema changes (knex migrations did all the work).
- No `kuma-pm2-push-sync` restart (the helper module was not touched).
- No project-root CHANGELOG entry: project does not maintain one
  (it is a fork). See `changelog-on-service-changes` workspace rule.
- No Discord changelog announcement: this fork is not registered as a
  channel in `/home/Changelog-Announcement/config.php`.
