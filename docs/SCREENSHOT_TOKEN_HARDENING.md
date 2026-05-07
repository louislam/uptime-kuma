# Screenshot Token Hardening — Follow-up to M-6

_Status: tracking issue, no code changes._
_Trigger: review of PR #26 (`perf/cache-screenshot-jwt`)._

## Background

Real Browser monitors capture page screenshots and serve them at
`/screenshots/<jwt>.png`. The `<jwt>` payload is the monitor id signed with
`jwtSecret` (HS256). M-6 caches the signed URL on the `Monitor` instance to
avoid signing on every `toJSON()` call.

## What the current scheme defends

- **URL forgery without the server secret** — HMAC integrity prevents anyone
  who doesn't know `jwtSecret` from forging a valid screenshot URL.
- **Monitor-id enumeration** — incrementing IDs to read other monitors'
  screenshots fails because the signature would mismatch.

## What it does not defend

| Gap | Why it matters |
|-----|---------------|
| No `exp` claim | Token valid forever. URL leaks (browser history, logs, support screenshots) become permanent capability. |
| No revocation | Deleted user / monitor still exposes screenshot if URL leaked. |
| No user binding | Anyone holding the URL fetches; no session check. |
| No `iat` / replay window | Old URLs survive secret rotation only because rotation isn't automated. |

## Why this is acceptable today

This fork's primary audience is self-hosted ops teams. Screenshots on the
dashboard are operational artefacts, not customer data. The risk surface is
small.

## When this becomes unacceptable

- Hosted / multi-tenant variant of Uptime Panda
- Screenshots that incidentally capture login pages, internal apps, or PII
- Any deployment where dashboard URLs may end up in shared support channels

## Hardening options

### Option 1 — Short-lived JWT with refresh

Add `expiresIn` to the sign call:

```js
jwt.sign({ id: this.id }, secret, { expiresIn: "5m" })
```

**Payload shape change — verifier update required.** M-6 currently signs
`this.id` directly (raw integer). Switching to `{ id: this.id }` to enable
`expiresIn` means the `/screenshots/:filename` verifier must read
`decoded.id` instead of treating the decoded value as the id. Search for
the existing `jwt.verify(filename, server.jwtSecret)` site and change the
consumer accordingly.

**Cost:** breaks M-6's cache. The URL changes every 5 minutes, so the cache
must time-bucket (cache valid for 4 minutes, refresh before the verifier
rejects). Acceptable amortisation; bulk emissions still amortise the JWT cost
across the bucket.

**Frontend invalidation:** when this lands, every open browser tab carries
stale `/screenshots/<oldjwt>.png` URLs. Add a one-time forced refresh of
the monitor list on first connect after deploy, or accept that users will
see broken thumbnails until they reload.

**Cache strategy when implementing:**

```js
get _signedScreenshotPath() {
    const now = Date.now();
    if (now >= this.__cacheExpiresAt) {
        const secret = UptimeKumaServer.getInstance().jwtSecret;
        this.__cachedScreenshotPath = "/screenshots/" + jwt.sign(
            { id: this.id }, secret, { expiresIn: "5m" }
        ) + ".png";
        // Refresh 60s before the JWT expires to avoid stale URLs in flight.
        this.__cacheExpiresAt = now + (4 * 60 * 1000);
    }
    return this.__cachedScreenshotPath;
}
```

(`__cacheExpiresAt` defaults to `undefined`, which `>=` coerces to `NaN`
and yields `false`; the first call still falls through. Initialising to
`0` in the constructor is cleaner if the Monitor model has one.)

**How to test:**
- Probe the URL → expect 200
- Wait > 5 minutes
- Probe the same URL → expect 401 (JWT expired)
- Reload dashboard → new URL with fresh JWT, expect 200

### Option 2 — Bind to user session

Include `uid: socket.userID` in the JWT payload. The `/screenshots/` route
checks the request session matches.

**Cost:** the URL becomes per-user. Cache must be keyed by `(monitorId, userId)`
on the Monitor instance, or moved out of the instance entirely (instance
shared across user sessions). Larger refactor.

**How to test:** Alice opens dashboard → captures URL → Bob (different session)
hits the same URL → expect 401/403.

### Option 3 — Opaque tokens with revocation table

Replace the JWT with a random opaque token stored in a new `screenshot_token`
table: `(token, monitor_id, user_id, expires_at)`. The route looks up the
token and checks ownership. Tokens can be revoked by row delete.

**Cost:** schema change, write per token issuance, GC for expired rows.
Heaviest option but the only one with first-class revocation.

**Schema notes:**
- `token` column: 256-bit random, base64url-encoded → 43 chars; index unique
- `expires_at` column: index for the cleanup query (`DELETE WHERE expires_at < NOW()`)
- GC cron: hourly is enough; the table stays bounded by `monitors x active_sessions`

**How to test:** issue a token, fetch screenshot, then `DELETE FROM screenshot_token`
for that monitor → next fetch returns 401.

### Option 4 — Periodic `jwtSecret` rotation

Cron rotates the secret weekly. All existing screenshot URLs and active
sessions invalidate at once.

**Cost:** disrupts logged-in users (they re-auth). Coordination with the
session/cookie layer. Doesn't address URL leakage between rotations.

**How to test:** rotate via DB (`UPDATE setting SET value=... WHERE key='jwtSecret'`),
restart, expect all clients to re-auth and old URLs to 401.

## Recommended next step

If the hosted variant ever materialises, ship Option 1 first — smallest
diff, biggest risk reduction (5-minute window vs. forever). Reconsider
Option 3 if revocation becomes a customer-visible requirement (e.g. a
"revoke all my open URLs" button in user settings).

## Conflict with M-6

Option 1 forces the cache strategy to evolve. The current `__cachedScreenshotPath`
is a single string; with TTL it must become `(path, expiresAt)`. The full code
change is in the snippet above.

Options 2 and 3 break the per-instance cache entirely — the URL becomes a
function of the request, not the Monitor row. M-6 would be reverted in that
case, with a different perf approach (server-side LRU keyed by `(monitorId, userId)`,
or shifting the JWT sign to socket emit time only).

## Action items

- [ ] Decide deployment model (self-hosted-only vs. hosted variant)
- [ ] If hosted: pick option (1 / 2 / 3 / 4) and file an implementation task
- [ ] Update M-6 cache strategy when option lands
- [ ] If shipping Option 1: queue the frontend monitor-list refresh hook
