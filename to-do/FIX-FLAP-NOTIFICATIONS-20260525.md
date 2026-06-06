# Fix: stop the "yellow/red" notification spam (push-monitor flapping)

Date (Europe/Oslo): 25/05/2026 21:47

## Symptom

Discord received a burst of "Your service PM2 X went down" / "is up" notifications
between 19:55 and 19:58 Oslo (17:55 to 17:58 UTC):

- PM2 consumer-safety-watchdog
- PM2 webhook-worker-5 (came back after 2m 55s downtime)
- PM2 webhook-worker-9
- PM2 webhook-worker-12
- PM2 webhook-worker-2
- PM2 webhook-worker-3
- PM2 webhook-worker-4

User wanted two things:

1. Stop the noisy yellow/red flap notifications.
2. Hide `PM2 rabbitmq-connection-cleanup` from
   https://status.newstargeted.com/status/infrastructure (intentional-stopped
   service, end users do not need to see it).

## Diagnosis

### 19:55-19:58 Oslo flap was the OLD-helper era

The notifications were from before today's helper rewrite (committed in
`FIX-KUMA-PUSH-SYNC-20260525.md`). The OLD helper used a 60 s loop, sequential
pushes, and silent `fetch failed` errors. While `news_apis` was holding rows in
`info.innodb_trx`, every push to Kuma's `/api/push` endpoint took 1-5 s, so a
single 33-monitor loop ran past 60 s and the next iteration overlapped. Push
monitors with `interval=60, maxretries=3` then walked through Pending (status=2)
and finally DOWN (status=0), firing one notification per transition.

Heartbeat trail for `PM2 webhook-worker-5` 17:50-18:05 UTC confirmed the
pattern: alternating status=1 and status=2 / status=0 spaced ~60 s apart.

### Post-rewrite the system is stable, but tolerance was still too tight

Per-minute audit of the helper post-rewrite:

| Oslo minute | pending | gone_down | up pushes |
| ----------- | ------: | --------: | --------: |
| 21:31       |       0 |         2 |         3 |
| 21:32       |       0 |         0 |        51 |
| 21:33-21:40 |       0 |       3\* |  ~50 each |
| 21:41       |      12 |         3 |        52 |
| 21:42       |       0 |         3 |        68 |

(\*the constant `gone_down=3` is the three intentionally-stopped services
`PM2 nt-canary`, `PM2 nt-canary2`, `PM2 rabbitmq-connection-cleanup`.)

Helper loop time varies from 5-37 s depending on `news_apis` row-lock pressure.
With monitor `interval=60`, a single slow loop can leave a real monitor's
heartbeat 65+ s old, which trips Kuma's "No heartbeat" watchdog. At 21:41 Oslo,
12 monitors flipped to status=2 for one beat, then recovered (no actual
notification fired), but the next contention spike could push them to status=0
and start paging again.

### Currently-DOWN monitors are intentional

`pm2 list` confirms `nt-canary`, `nt-canary2`, and `rabbitmq-connection-cleanup`
are all `stopped` (not failing). The helper marks them DOWN with
`PM2 X stopped`, which is correct.

## Fix

All changes applied 25/05/2026 around 21:47 Oslo.

### 1. Hide `rabbitmq-connection-cleanup` from `/status/infrastructure`

```sql
DELETE FROM monitor_group WHERE id = 92;
-- row 92 was the relation linking monitor_id=28
-- (PM2 rabbitmq-connection-cleanup) to group_id=6 (Platform Infrastructure)
-- on status_page slug='infrastructure'.
```

Verified via `GET /api/status-page/heartbeat/infrastructure`: response now
returns monitor ids `[13, 14, 15, 21, 27, 29, 32]`. id `28` is gone.

The monitor itself is preserved so admins still see its state inside Kuma.

### 2. Bump tolerance on every PM2 push monitor

```sql
UPDATE monitor
SET `interval` = 120, retry_interval = 120
WHERE type='push' AND active=1 AND name LIKE 'PM2 %';
```

33 rows updated, all moved from `60/60/3` to `120/120/3`.

Effective grace before a DOWN notification:

- Old: 60 s (Pending) + 3 retries x 60 s = **4 minutes**.
- New: 120 s (Pending) + 3 retries x 120 s = **8 minutes**.

This is well above the worst observed helper loop time (37 s) plus the 30 s
loop period, so a single slow tick will no longer push a monitor past Pending.
Genuine outages still alert, just 4 minutes later than before.

`maxretries=3` left untouched on purpose: it gives 3 watchdog cycles of grace,
which at 120 s each = 6 minutes of follow-up checks before declaring DOWN.

### 3. Reload Kuma so cached `interval` / `retry_interval` pick up new values

`pm2 reload status-uptime-kuma --update-env` (port 3011 came back ~38 s later;
helper saw ECONNREFUSED briefly but stayed under the new 120 s tolerance, so no
flap notifications fired).

## Verify

```sql
-- All push monitors at new tolerance
SELECT COUNT(*), MIN(`interval`), MAX(`interval`),
       MIN(retry_interval), MAX(retry_interval), MIN(maxretries), MAX(maxretries)
FROM monitor WHERE type='push' AND active=1 AND name LIKE 'PM2 %';
-- Result: 33 / 120 / 120 / 120 / 120 / 3 / 3

-- rabbitmq-connection-cleanup absent from infrastructure page
SELECT * FROM monitor_group WHERE id = 92;
-- Empty set
```

API check:

```bash
curl -fsS http://127.0.0.1:3011/api/status-page/heartbeat/infrastructure \
  | jq '.heartbeatList | keys'
# ["13","14","15","21","27","29","32"]
```

## Operator notes

- If you ever want to bring `rabbitmq-connection-cleanup` back onto the public
  Infrastructure page, recreate the row:

  ```sql
  INSERT INTO monitor_group (monitor_id, group_id, weight)
  VALUES (28, 6, 4);
  ```

- If 8 minutes of grace ever feels too long for a specific service (e.g. a
  customer-facing API), set its `interval` back to 60 individually:

  ```sql
  UPDATE monitor SET `interval`=60, retry_interval=60
  WHERE name='PM2 nt-main';
  ```

- The 3 intentional-stopped services (`nt-canary`, `nt-canary2`,
  `rabbitmq-connection-cleanup`) will continue to show DOWN inside Kuma. They
  do not generate fresh notifications because Kuma only fires on UP→DOWN
  transitions, and they have been DOWN since 24 h ago. If you ever want to
  silence them entirely, detach the Discord notifier:

  ```sql
  DELETE FROM monitor_notification
  WHERE monitor_id IN (22, 23, 28) AND notification_id = 1;
  ```
