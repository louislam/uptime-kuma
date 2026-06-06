# Socket.IO WebSocket fix: 25/05/2026

## Symptom

`https://status.newstargeted.com/manage-status-page` (and any other
admin route) rendered only the dark-mode "Uptime Kuma" header.
No nav, no content, no spinner, no login form, even in a fresh
incognito window. Console reported no JavaScript errors.

## Root cause

The CyberPanel/LiteSpeed vhost only proxied plain HTTP to
`127.0.0.1:3011`. There was no WebSocket Proxy block, so Socket.IO
WebSocket upgrade requests on `/socket.io/?transport=websocket` were
not forwarded to Kuma. Browsers fell back to long-polling.

Long-polling cycles time out at about 25 seconds. The Kuma
`afterLogin` flow on this server takes 30-75 seconds (large monitor

- status page set, cold-cache `getStatusPageData` is 24 seconds).
  That meant the `loginByToken` callback never returned, so neither
  `$root.loggedIn` nor `$root.allowLoginDialog` ever became `true`.
  Per `src/layouts/Layout.vue` lines 129-130:

```vue
<router-view v-if="$root.loggedIn" />
<Login v-if="!$root.loggedIn && $root.allowLoginDialog" />
```

When both conditions are false, the entire content area is empty.
That is exactly what the screenshot showed.

The Kuma error log captured the symptom: every 7-8 seconds a
`New polling connection, IP = 127.0.0.1` repeated, with `Login by
token` and `Username from JWT` but no follow-up `Successfully
logged in` for 41-75 seconds, while the browser had already
disconnected and reconnected.

## Fix

### 1. `/usr/local/lsws/conf/vhosts/status.newstargeted.com/vhost.conf`

Added a vhost-level WebSocket Proxy block and an explicit HTTP
proxy context for `/socket.io/`:

```apache
extprocessor status_uptime_kuma {
  type                    proxy
  address                 http://127.0.0.1:3011
  ...
}

# Added: Socket.IO WebSocket upgrade
websocket /socket.io/ {
  address                 127.0.0.1:3011
}

# Added: Socket.IO HTTP polling fallback (the websocket block alone
# captures /socket.io/ and 404s non-Upgrade requests).
context /socket.io/ {
  type                    proxy
  handler                 status_uptime_kuma
  addDefaultCharset       off
  enableIpGeo             1
}
```

Restart: `/usr/local/lsws/bin/lswsctrl restart`.

A snapshot of the full new vhost.conf lives in
`to-do/lsws-vhost.conf.snapshot` for reference (the vhost itself is
outside the repo at `/usr/local/lsws/conf/vhosts/status.newstargeted.com/`).

### 2. `.htaccess`

Removed the now-redundant `RewriteRule ^(.*)$ http://127.0.0.1:3011/$1 [P,L]`.
LiteSpeed's `context /` proxy already forwards everything; an Apache
`[P]` rewrite in `.htaccess` does not enable WebSocket proxying on
LSWS and could conflict with the new vhost-level routing.

Kept in `.htaccess`:

- HTTPS enforcement (301 redirect)
- ACME challenge passthrough
- `RequestHeader set X-Forwarded-Proto "https" env=HTTPS`
- Security headers (`X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `X-XSS-Protection`) and the embed CSP
  (`frame-ancestors 'self' https://newstargeted.com
https://www.newstargeted.com`).

## Verification

1. WebSocket upgrade through Cloudflare returns `HTTP/1.1 101
Switching Protocols` with the correct `Sec-WebSocket-Accept`.
2. HTTP polling on `/socket.io/?EIO=4&transport=polling` returns
   the Engine.IO handshake JSON
   (`0{"sid":"...","upgrades":["websocket"],...}`).
3. Kuma log now shows for each new browser session:
   - `New polling connection`
   - `New websocket connection` <-- upgrade succeeds
   - `WebSocket with no origin is allowed`
4. `Successfully logged in user Admin` no longer takes 41-75 s; it
   completes within 1-2 s once WS replaces polling.

## Files changed

- `.htaccess` (in repo, committed)
- `to-do/FIX-SOCKETIO-WEBSOCKET-20260525.md` (this file, committed)
- `to-do/lsws-vhost.conf.snapshot` (snapshot only, committed for reference)
- `/usr/local/lsws/conf/vhosts/status.newstargeted.com/vhost.conf`
  (outside repo, backed up to
  `vhost.conf.bak-20260525-195217` next to it)
