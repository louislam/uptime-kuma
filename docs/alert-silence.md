# Alert Silence (Alert Acknowledgment)

Alert Silence lets you acknowledge a known issue on a DOWN monitor. While a monitor is silenced, checks continue to run normally but notifications are suppressed. The silence is automatically cleared when the monitor recovers to UP.

This concept is equivalent to the "acknowledgment" feature found in Nagios, Zabbix, and Centreon, and uses the same conventional violet color (`#8b5cf6`).

---

## User Guide

### Silencing a single monitor

1. Open the **detail page** of any monitor that is currently **DOWN**.
2. Click the **Silence** button (bell-slash icon, shown in violet).
3. A dialog appears asking for a mandatory **reason / message** (e.g. "Known issue, investigating…").
4. Click **Silence** to confirm.

### Bulk silencing from the monitor list

1. Enable **select mode** by clicking the checkbox in the list header.
2. Select one or more monitors.
3. Open the **Actions** dropdown → click **Silence**.
4. Enter a mandatory reason and confirm.

**Constraints (single and bulk):**

- The monitor must be **active** (not paused).
- The monitor must be **DOWN** — silencing an UP monitor is blocked with an error.
- Already-silenced monitors are skipped automatically in bulk mode.

While silenced:

- The monitor continues its normal check cycle (heartbeats are still recorded).
- All notifications are suppressed (DOWN alerts, resend intervals, etc.).
- A violet badge with a bell-slash icon appears next to the monitor name in the list.
- An info banner is shown at the top of the detail page with the silence message and date.
- The silence event is written as an **important** heartbeat entry so it appears in the event history with a violet "Silenced" badge.

### Unsilencing a monitor

There are two ways to clear a silence:

| Method | When it happens |
| --- | --- |
| **Automatic** | The monitor recovers to UP — the silence is cleared instantly. |
| **Manual** | Click the **Unsilence** button on the detail page. |

After the silence is cleared, notifications resume normally for any subsequent DOWN events.

### Monitor list filter

Silenced monitors are **hidden by default** to keep the view clean.

To show them: open the **Status filter** dropdown → click **Silenced** (only visible when at least one monitor is silenced, or the filter is already active). The Silenced entry appears between Maintenance and Pending.

---

## Developer Reference

### Database schema

The migration `db/knex_migrations/2026-07-25-0000-add-monitor-silence.js` adds four columns to the `monitor` table:

| Column | Type | Description |
| --- | --- | --- |
| `silenced` | `BOOLEAN NOT NULL DEFAULT 0` | Whether the monitor is currently silenced |
| `silence_message` | `TEXT` | Mandatory reason supplied by the user |
| `silenced_at` | `DATETIME` | UTC timestamp when the silence was applied |
| `silenced_by` | `INTEGER` | User ID that triggered the silence |

### Socket events

Handler: `server/socket-handlers/silence-socket-handler.js`.

#### `silenceMonitor(monitorID, message, callback)`

**Preconditions checked server-side:**

- User must be logged in.
- `message` must be a non-empty string.
- Monitor must belong to the authenticated user.
- Last heartbeat must have `status = 0` (DOWN).

**Side effects:**

- Updates the four `silenced_*` columns (timestamps stored as UTC via `dayjs.utc()`).
- Inserts an important heartbeat entry (`important = 1`) with `msg = "Silenced: <message>"` — the `"Silenced: "` prefix is used internally to identify the entry for the history badge; only the user message is shown in the UI.
- Emits a `heartbeat` event with `type: "silence"` to skip the toast notification in `src/mixins/socket.js`.
- Calls `sendUpdateMonitorIntoList` to refresh the monitor list immediately.

**Callback on success:** `{ ok: true, msg: "successSilenced", msgi18n: true }`

#### `unsilenceMonitor(monitorID, callback)`

Resets all four `silenced_*` columns and refreshes the monitor list.

**Callback on success:** `{ ok: true, msg: "successUnsilenced", msgi18n: true }`

### Auto-clear on recovery

In `server/model/monitor.js`, after each heartbeat check:

```js
if (this.silenced) {
    // suppress notification

    if (bean.status === UP) {
        // R.exec("UPDATE monitor SET silenced=0 ...") — raw SQL to avoid saving runtime JS properties
        // this.silenced = false; this.silence_message = null; ... (in-memory update)
        // sendUpdateMonitorIntoListByUserID(this.user_id, this.id)
    }
} else if (Monitor.isImportantForNotification(...)) {
    await Monitor.sendNotification(...);
}
```

The resend-interval block also skips silenced monitors:

```js
if (!this.silenced && bean.status === DOWN && this.resendInterval > 0) { ... }
```

> **Why `R.exec` instead of `R.store`**: the monitor instance holds runtime-only JS properties (e.g. `rootCertificates`, Prometheus objects) that don't exist as DB columns. Calling `R.store(this)` inside the beat loop would fail with `SQLITE_ERROR: no such column`. `R.exec` with an explicit column list is safe.

### Frontend

#### `src/mixins/socket.js`

- `stats.silenced` counter increments when `monitor.silenced === true`.
- Heartbeat events with `type === "silence"` skip the toast notification block.

#### `src/components/MonitorList.vue`

- `filterState.showSilenced` (boolean, default `false`) controls visibility of silenced monitors.
- `filterFunc` hides monitors with `monitor.silenced === true` unless `filterState.showSilenced` is `true`.
- **Bulk silence**: Actions dropdown → Silence → modal with required reason field. Only DOWN, active, unsilenced monitors are processed; any UP monitor in the selection blocks the action entirely.

#### `src/components/MonitorListFilter.vue`

- The **Silenced** entry appears between Maintenance and Pending in the Status dropdown.
- Only rendered when `$root.stats.silenced > 0` or the filter is already active.

#### `src/components/MonitorListItem.vue`

- A violet `silence-badge` with bell-slash icon is shown after the monitor name when `monitor.silenced` is true. Hovering shows the silence message.

#### `src/pages/Details.vue`

- **Silence button**: visible when `!monitor.silenced && lastHeartBeat.status === 0`.
- **Unsilence button**: visible when `monitor.silenced`.
- **Event history**: silence entries show a violet "Silenced" badge in the Status column (identified by `msg.startsWith('Silenced:')`); the displayed message strips the prefix so only the user's text is shown.

### Styles

| Token | Value | Usage |
| --- | --- | --- |
| `$silenced` (SCSS) | `#8b5cf6` | Defined in `src/assets/vars.scss` |
| `.bg-silenced` | background `$silenced`, text white | Badges, confirm buttons |
| `.text-silenced` | text color `$silenced` | Silence / Unsilence action buttons |
| `.silence-badge` | inline violet badge | `MonitorListItem.vue` |
| `.modal-backdrop-silence` / `.silence-modal` | overlay modal | `Details.vue`, `MonitorList.vue` |

### i18n keys (`src/lang/en.json`)

| Key | English value |
| --- | --- |
| `Silence` | Silence |
| `Unsilence` | Unsilence |
| `Silenced` | Silenced |
| `silenceMonitor` | Silence Monitor |
| `silenceMonitorDesc` | Notifications will be suppressed while the monitor continues to run. The silence is automatically cleared when the monitor recovers. |
| `silenceMessage` | Reason / Message |
| `silenceMessagePlaceholder` | e.g. Known issue, investigating… |
| `silencedMonitorMsg` | Notifications silenced |
| `silencedAt` | Silenced at |
| `successSilenced` | Monitor silenced successfully. |
| `successUnsilenced` | Monitor unsilenced successfully. |
| `silenceMessageRequired` | A reason is required to silence a monitor. |
| `silenceOnlyDownMonitor` | Only a DOWN monitor can be silenced. |
| `silencedMonitorsMsg` | Silenced {n} monitor \| Silenced {n} monitors |
| `noMonitorsSilencedMsg` | No monitors silenced (none were DOWN and unsilenced) |
| `bulkSilenceErrorMsg` | Failed to silence {n} monitor \| Failed to silence {n} monitors |
| `silenceOnlyDownMonitorBulk` | Cannot silence: all selected monitors must be DOWN. |

### Files changed / created

| File | Change |
| --- | --- |
| `db/knex_migrations/2026-07-25-0000-add-monitor-silence.js` | New migration — 4 columns on `monitor` |
| `server/socket-handlers/silence-socket-handler.js` | New socket handler (`silenceMonitor`, `unsilenceMonitor`) |
| `server/model/monitor.js` | Notification suppression + auto-clear on UP + `toJSON` fields |
| `server/uptime-kuma-server.js` | `sendUpdateMonitorIntoListByUserID` helper for background context |
| `server/server.js` | Import and registration of `silenceSocketHandler` |
| `src/icon.js` | Added `faBell`, `faBellSlash` to FontAwesome library |
| `src/assets/vars.scss` | `$silenced: #8b5cf6` color variable |
| `src/assets/app.scss` | `.bg-silenced`, `.text-silenced` utility classes |
| `src/mixins/socket.js` | `stats.silenced` counter + skip toast for `type: "silence"` |
| `src/components/MonitorList.vue` | Silenced filter state + bulk silence action |
| `src/components/MonitorListFilter.vue` | Silenced toggle in Status dropdown |
| `src/components/MonitorListItem.vue` | Silence badge next to monitor name |
| `src/pages/Details.vue` | Silence/Unsilence buttons, modal, info banner, history badge |
| `src/lang/en.json` | 17 new i18n keys |
| `src/lang/*.json` (69 files) | Same keys added with English fallback values |
