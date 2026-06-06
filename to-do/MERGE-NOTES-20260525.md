# Upstream merge notes: 25/05/2026

## Summary

Merged `louislam/master` into local branch `Krao/pm2-system-service-platform`
on 25/05/2026 kl. 04:27.

- Upstream HEAD before merge: `74c43a33` (08/05/2026)
- Upstream HEAD after merge: `6a10d82f` (23/05/2026)
- Merge commit (local): `c4f085d2`
- Uptime Kuma version: still `2.3.2` (no version bump upstream)

## Commits pulled in (10)

| SHA      | Date       | Type  | Description                                                     |
| -------- | ---------- | ----- | --------------------------------------------------------------- |
| 3fcddaf0 | 09/05/2026 | fix   | update link to documentation about API keys (#7373)             |
| 0c5371af | 10/05/2026 | fix   | NTLM monitor over plain HTTP fails with 400 Bad Request (#7351) |
| b45c6374 | 12/05/2026 | chore | temporary disable github actions cache (#7388)                  |
| 6a2f0714 | 13/05/2026 | fix   | normalize hidden log level lookup (#7390)                       |
| 7c41b08f | 16/05/2026 | chore | Add a workflow for `ai-slop` tag (#7403)                        |
| 4f74fc29 | 16/05/2026 | chore | Follow up of "Add a workflow for ai-slop tag" (#7404)           |
| bc6ca6e9 | 16/05/2026 | chore | New AI slop policy (#7405)                                      |
| 5f3f1f54 | 21/05/2026 | chore | Anti AI slop workflow for issue too (#7419)                     |
| 916ea813 | 22/05/2026 | chore | Secure all workflows with `pull_request_target` (#7424)         |
| 6a10d82f | 23/05/2026 | chore | Add a workflow to mark a pull request as "deleted" (#7428)      |

Real runtime impact: 3 small bug fixes + 1 docs link update.  
The rest are GitHub Actions workflow changes only (no runtime impact).

## Files changed by the merge (13)

- `server/model/monitor.js` (+1) - NTLM HTTP fix; coexists with our PM2 validation block at line 1734
- `src/components/settings/APIKeys.vue` - docs URL
- `src/util.js`, `src/util.ts` - hidden log level lookup fix
- `AGENTS.md` - upstream AI-slop policy text (informational, not a runtime change)
- `.github/workflows/*.yml` - 7 workflow files (no runtime impact)

## Fork-only files preserved through the merge (intact)

- `server/monitor-types/pm2.js`
- `server/util/pm2.js`
- `test/backend-test/test-pm2.js`
- `server/monitor-types/system-service.js` (fork modifications)
- `server/socket-handlers/general-socket-handler.js` (fork modifications)
- `server/uptime-kuma-server.js` (fork modifications, also dirty)
- `src/pages/EditMonitor.vue` (fork modifications)
- `src/lang/en.json` (fork modifications)

## Uncommitted local changes preserved (stashed during merge, popped after)

Modified:

- `ecosystem.config.js`
- `server/model/status_page.js`
- `server/routers/status-page-router.js`
- `server/server.js`
- `server/uptime-kuma-server.js`
- `server/util-server.js`
- `src/pages/StatusPage.vue`

Untracked (preserved):

- `.htaccess`
- `modules/pm2-kuma-push-sync.js`
- `server/modules/webhook-pipeline-metrics.js`
- `sql/add-tags.sql`, `sql/backup-before-tags-20260525-041107.sql`
- `src/components/WebhookPipelineMetrics.vue`

## Build and restart

- `npm run build` (vite): success, 160s
- `pm2 restart status-uptime-kuma --update-env`: success, single restart
- `kuma-pm2-push-sync`: untouched (no restart needed)
- Health check: HTTP/1.1 200 on `/status/newstargeted-status`, public HTTPS 302 redirect OK
- Listening on `*:3011` (PID 26594)

## Backup taken before merge

Location: `/home/backup/status.newstargeted.com-20260525-041920-pre-merge/`

| File                                   | Size | SHA-256 (prefix)           |
| -------------------------------------- | ---- | -------------------------- |
| `status.newstargeted.com-files.tar.gz` | 40M  | 5ddf8790...                |
| `news_status.sql.gz`                   | 1.6M | 2fb7bff9...                |
| `BACKUP-README.txt`                    | -    | (manifest + restore steps) |

The tarball excludes `node_modules/`, `dist/`, and `data/error.log`. Restore
instructions are in `BACKUP-README.txt`.

## What was NOT done

- No `npm ci` (upstream did not change `package.json` / `package-lock.json`).
- No DB schema migration (no DB-touching commits upstream).
- No changes to fork's PM2 push sync (`kuma-pm2-push-sync` not restarted).
- No `CHANGELOG.md` created at project root: project does not currently
  maintain one. See `changelog-on-service-changes` workspace rule.
