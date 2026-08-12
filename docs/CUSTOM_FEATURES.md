# Custom features on top of Uptime Kuma

This fork adds four features not present in upstream Uptime Kuma. This doc
explains what they do, how to use them, and where the code lives, so future
work (by you or an agent) doesn't have to rediscover it from scratch.

1. [Per-group dedicated status pages](#1-per-group-dedicated-status-pages)
2. [Public email subscriptions per group](#2-public-email-subscriptions-per-group)
3. [Sticky footer + subscribe field placement](#3-sticky-footer--subscribe-field-placement)
4. [Maintenance emails + per-group Maintenance and Incident Log](#4-maintenance-emails--per-group-maintenance-and-incident-log)

---

## 1. Per-group dedicated status pages

Each monitor group on a public status page can now be opened as its own
page, instead of only collapsing/expanding inline.

- **URL**: `/status/:slug/group/:groupId`
- **Entry points**: clicking a group's title, or clicking anywhere in the
  group's monitor block (except on an actual link, e.g. a monitor's URL —
  that still opens the link normally). Both are disabled while in edit mode.
- **Back button**: the dedicated group page shows a "Back to Status Page"
  button styled `btn-primary` (not the default `btn-outline-secondary`,
  which was unreadable in dark theme).

**Code**:
- Route: [`src/router.js`](../src/router.js)
- Navigation logic (`titleClicked`, `blockClicked`, `openGroupPage`,
  `isGroupBlockClickable`): [`src/components/PublicGroupList.vue`](../src/components/PublicGroupList.vue)
- Page wiring (`routeGroupId`, back-link): [`src/pages/StatusPage.vue`](../src/pages/StatusPage.vue)

---

## 2. Public email subscriptions per group

Anonymous visitors can subscribe (by email only, no account) to a single
group's alerts: monitor up/down changes for monitors in that group, and any
incident posted on the status page. Scope is **per group**, not per monitor
and not "subscribe to everything on this page."

### Visitor flow

1. On a group's dedicated page (`/status/:slug/group/:groupId`), a small
   "Subscribe to Notifications" field sits above the footer, right-aligned,
   intentionally unobtrusive (`src/components/GroupSubscribeForm.vue`).
2. Visitor enters an email → gets a confirmation email (double opt-in).
   Nothing is sent to anyone else until they click confirm.
3. Once confirmed, they get emailed on monitor up/down changes for that
   group, and on status-page incidents.
4. Every alert email includes a one-click unsubscribe link/button
   (`List-Unsubscribe` / `List-Unsubscribe-Post` headers, RFC 8058), so
   mail clients can show a native "Unsubscribe" button. There's also a
   plain-text link in the body for clients that don't support it.

### Admin setup

1. Edit a status page → pick a **Subscriber Email Notification** from the
   dropdown (only SMTP-type notifications you've already configured show
   up here). This is what subscriber emails for that page are sent through
   — no separate mail server to set up.
2. If no SMTP notification is picked, subscribing is skipped entirely for
   that page — the form still shows, but no row is created and no mail is
   sent, so don't be surprised if subscriptions silently do nothing until
   a notification is selected here.

### Viewing / managing subscribers

- In **edit mode**, each group title has a small people icon (👥) —
  visible only for groups that have already been saved (have an id).
- Click it to open a modal listing that group's subscribers: email,
  confirmed/pending status, and a remove button per subscriber.
- This is per-group, not per-monitor — there is no per-monitor subscriber
  view (see chat history for the reasoning: monitors already belong to
  groups, and the page's incidents aren't monitor-scoped anyway).

### Security measures

- **Anti-enumeration**: the subscribe endpoint always returns the same
  generic response regardless of whether the email is new, a duplicate, or
  invalid — no signal is leaked either way.
- **Rate limiting**: `subscribeRateLimiter` in
  [`server/rate-limiter.js`](../server/rate-limiter.js) throttles the
  public subscribe endpoint.
- **SQL injection**: all DB access goes through parameterized `R.*` calls
  (redbean-node), no string concatenation anywhere in
  [`server/model/status_page_subscriber.js`](../server/model/status_page_subscriber.js).
- **Tokens**: 64-char hex (`crypto.randomBytes(32)`), unique per row.
  Rotated on confirm and cannot be replayed. Unsubscribe/confirm requests
  validate the token's shape before hitting the DB.
- **Idempotent unsubscribe**: unsubscribing with an unknown/already-used
  token returns the same 200 response as a real one — no enumeration
  signal there either.
- **Double opt-in**: no alert email is ever sent to an address until it's
  confirmed via the link sent to that address.
- **Resend cooldown**: re-submitting the same unconfirmed email is
  throttled (60s) instead of spamming a fresh confirmation email each time.

### Code map

| Piece | File |
|---|---|
| DB schema | `db/knex_migrations/2026-08-10-0000-add-status-page-subscriptions.js` |
| Core model (subscribe/confirm/unsubscribe/notify) | `server/model/status_page_subscriber.js` |
| Public REST routes | `server/routers/subscription-router.js` |
| Rate limiter | `server/rate-limiter.js` (`subscribeRateLimiter`) |
| Shared SMTP transport logic | `server/notification-providers/smtp.js` (`buildTransportConfig`) |
| Monitor up/down hook | `server/model/monitor.js` (`sendNotification`) |
| Incident hook + admin socket handlers | `server/socket-handlers/status-page-socket-handler.js` |
| Admin `subscriptionNotificationId` field | `server/model/status_page.js` (`toJSON`, admin-only — not in `toPublicJSON`) |
| Subscribe form (visitor-facing) | `src/components/GroupSubscribeForm.vue` |
| Subscriber management modal (admin) | `src/components/GroupSubscribersModal.vue` |
| SMTP notification picker (edit mode) | `src/pages/StatusPage.vue` (`smtpNotificationList`) |

### Tests

- Backend unit tests (mocked SMTP, no real mail server needed):
  `test/backend-test/test-status-page-subscriber.js` — run with:
  ```bash
  npm run test-backend-22
  ```
- E2E: extended in `test/e2e/specs/status-page.spec.js`
  (`"clicking a group opens its dedicated page"`,
  `"visitors can subscribe to a group's notifications"`, etc.). **Not
  currently runnable in this dev environment** — the project's pinned
  `playwright`/`@playwright/test` (`~1.39.0`, Oct 2023) ships a Chromium
  build that won't launch stably on current macOS/Apple Silicon. Fix would
  be bumping that devDependency; deliberately left alone for now per an
  earlier decision to not touch it while chasing this feature.

---

## 3. Sticky footer + subscribe field placement

- The page footer is pinned to the bottom of the viewport even when there
  are only one or two monitors (previously it would float right under the
  content on short pages).
- On a group's dedicated page, a row sits directly above the footer with the
  Maintenance and Incident Log (see below) on the left and the subscribe
  field on the right, so the whole row always moves together with the
  footer as one unit.

**How**: `src/pages/StatusPage.vue` — `.main` is a flex column with
`min-height: calc(100vh - 1rem)`; `.page-footer-area` (wrapping the
`.group-footer-row` + `<footer>`) uses `margin-top: auto` to push itself to
the bottom. `.group-footer-row` is itself a flex row (`flex-wrap` so it
stacks on mobile) holding `GroupLogPanel` (`flex: 1 1 60%`) and
`GroupSubscribeForm` (`flex: 0 0 auto`). Confirmed correct in both
light/dark theme and in edit mode (where `.main.edit` also has a
`margin-left: 300px` sidebar offset).

---

## 4. Maintenance emails + per-group Maintenance and Incident Log

Two additions on top of the per-group subscription feature above.

### Maintenance emails

When a scheduled maintenance window is first linked to monitors, every
confirmed subscriber of every public group those monitors belong to gets a
"Maintenance scheduled" email (same delivery mechanism as monitor/incident
alerts — unsubscribe link and headers included).

- **Fires once**: only the first time a maintenance is successfully linked
  to at least one monitor. Editing the maintenance afterward (time,
  description, even changing which monitors are attached) does **not**
  re-send it.
- Existing maintenance windows (created before this feature shipped) are
  never retroactively emailed — a `maintenance.subscriber_notified` column
  defaults new rows to `false` (eligible) and backfills every pre-existing
  row to `true` (already "notified", i.e. skipped) at migration time.
- Race-safety: the one-time send is guarded by an atomic
  `UPDATE maintenance SET subscriber_notified = true WHERE subscriber_notified = false`
  (via `R.knex`, since `R.exec()` in this redbean-node version discards the
  affected-row count) rather than a read-then-write, so two rapid saves of
  the same maintenance can't double-send.
- **Off by default, per maintenance**: a "Notify Subscribers" checkbox on
  the add/edit maintenance form (`maintenance.notify_subscribers`, defaults
  `false`) controls whether *this* maintenance's one-time email fires at
  all. Minor/routine maintenances can be left unchecked to avoid spamming
  subscribers — the maintenance is still always recorded in the group's
  Maintenance and Incident Log either way (see below), only the email is
  gated. The check lives in `StatusPageSubscriber.notifyMaintenanceScheduled`
  itself (early-returns if the flag is off), not in the socket handler, so
  the "fires once" claim logic above is unaffected — it just becomes a
  once-if-enabled send.

### Maintenance and Incident Log

A per-**group** (not per-monitor, not page-wide) timeline shown on the
group's dedicated page, to the left of the subscribe field. Auto-populated
from real events, and admins can also add fully custom entries.

- **Auto-populated**: every time a new maintenance is first linked to
  monitors (same trigger as the email above), and every time a *new*
  incident is posted (not on incident edits or resolves), a log entry is
  created on each affected public group automatically.
- **Manual entries**: a logged-in admin can add/edit/delete entries of
  either type (Maintenance or Incident) directly on the group page — these
  don't need to correspond to a real maintenance/incident record. Editing
  an auto-generated entry's text doesn't affect the original record it came
  from (log entries are a snapshot, not a live link).
- This is deliberately separate from the existing page-wide "Past
  Incidents" section (`IncidentHistory.vue`/`server/model/incident.js`) —
  that system is unrelated and untouched.
- **Important quirk**: full page **edit mode** (`enableEditMode`) can
  *never* be true on a group's dedicated page — `edit()` in
  `src/pages/StatusPage.vue` explicitly requires `!routeGroupId`, so all the
  wider page-editing UI (footer text, group list, monitors, etc.) stays
  main-page-only by design. The log panel's admin controls are therefore
  gated on `hasToken` (a stored JWT exists) instead, **not** `enableEditMode`.
  Since `/status/*` pages don't run socket.io for anonymous visitors
  (`noSocketIOPages` in `src/mixins/socket.js`), a logged-in admin still
  needs a real socket connection on the group page for the log's
  add/edit/delete socket calls to work — `StatusPage.vue`'s `created()`
  hook explicitly calls `this.$root.initSocketIO(true)` when
  `hasToken && routeGroupId`, bypassing the anonymous-visitor skip just for
  this case (full edit mode is still unreachable there).
- Public reads go through a plain REST endpoint (cached 5 minutes,
  invalidated on any admin write) since `/status/*` pages don't run
  socket.io for anonymous visitors. Admin add/edit/delete go through socket
  handlers, same as every other admin action.

### Code map

| Piece | File |
|---|---|
| DB schema | `db/knex_migrations/2026-08-11-0000-add-group-log-and-maintenance-notify.js`, `db/knex_migrations/2026-08-12-0000-add-maintenance-notify-subscribers-flag.js` |
| Log model (CRUD + auto-entry creation) | `server/model/group_log_entry.js` |
| Maintenance-email method + notify-flag gate | `server/model/status_page_subscriber.js` (`notifyMaintenanceScheduled`) |
| Maintenance model field | `server/model/maintenance.js` (`toPublicJSON`/`jsonToBean`, `notifySubscribers`) |
| Maintenance hook (one-time claim) | `server/socket-handlers/maintenance-socket-handler.js` (`addMaintenance`, `addMonitorMaintenance`) |
| Incident hook + admin log CRUD handlers | `server/socket-handlers/status-page-socket-handler.js` (`postIncident`, `addGroupLogEntry`/`editGroupLogEntry`/`deleteGroupLogEntry`) |
| Public REST route | `server/routers/subscription-router.js` (`GET /api/status-page/group/:groupId/log`) |
| Log panel (visitor + admin UI) | `src/components/GroupLogPanel.vue` |
| Notify Subscribers checkbox | `src/pages/EditMaintenance.vue` |
| Layout wiring | `src/pages/StatusPage.vue` (`.group-footer-row`) |

### Tests

- Backend unit tests: `test/backend-test/test-group-log-entry.js` (CRUD
  validation/scoping, auto-entry group resolution/dedup, and the atomic
  `subscriber_notified` claim mechanism) and new cases in
  `test/backend-test/test-status-page-subscriber.js`
  (`notifyMaintenanceScheduled`) — run with:
  ```bash
  npm run test-backend-22
  ```
- E2E: not extended for this feature, same Playwright limitation as above.

---

## Local dev quick reference

```bash
npm run dev              # frontend :3000 + backend :3001, CORS wired for dev
npm run test-backend-22  # backend unit tests (node:test)
```

A `.claude/launch.json` config named `uptime-kuma-dev` is set up in the
parent repo for browser-preview tooling to attach to this dev server.

**Gotcha**: `server/database.js`'s `getDevDataDir()` picks the SQLite data
directory based on the current git branch name — `master` uses `./data/`,
any other branch (e.g. a feature branch) gets its own empty
`./data/dev-data/<branch>/`, to avoid migration conflicts between branches
being tested in parallel. This means switching branches mid-session gives
you a *different, unseeded* database unless you override it:
```bash
DATA_DIR=./data/ npm run dev   # force the shared master data dir regardless of branch
```
`process.env.DATA_DIR` always wins over the branch-based logic.
