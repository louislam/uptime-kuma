# Uptime Kuma API Documentation (Detailed)

Uptime Kuma primarily uses **WebSockets** for real-time communication after authentication. It also provides **RESTful API endpoints** for push monitors, status badges, Prometheus metrics, and public status page data.

## Authentication

### REST API

-   **Push Monitors (`/api/push/:pushToken`)**: Authenticated via the unique `:pushToken` in the URL path. No other authentication needed for this endpoint.
-   **Metrics (`/metrics`)**: Authentication depends on server settings (`Settings` -> `Security` -> `API Keys`):
    -   **API Key Authentication (If Enabled):**
        -   Method: HTTP Basic Auth.
        -   Username: (empty string or any value, it's ignored).
        -   Password: Your generated API Key (e.g., `uk2_somereallylongkey`).
    -   **Basic User Authentication (If API Keys Disabled or Not Provided):**
        -   Method: HTTP Basic Auth.
        -   Username: Your Uptime Kuma username.
        -   Password: Your Uptime Kuma password.
    -   **No Authentication (If Auth Disabled in Settings):**
        -   No credentials required. Access is open.
-   **Badges & Public Status Pages**: These endpoints are generally public. Access to monitor-specific badges depends on the monitor being included in a _public_ group on any status page. Status page data endpoints (`/api/status-page/...`) require the status page itself to be _published_.

### WebSocket API

1.  Establish a WebSocket connection.
2.  **Authentication:** The client must authenticate _after_ connection using one of these events:
    -   `login` Event: Provide username, password, and optionally a 2FA token.
    -   `loginByToken` Event: Provide a JWT token obtained from a previous successful login where "Remember Me" was selected.
3.  **Authorization:** Once authenticated via `login` or `loginByToken`, all subsequent events sent on that specific socket connection are authorized for the logged-in user.

## Common Data Structures

_(Used in WebSocket events and some API responses)_

-   **Monitor Object (Partial Example):**
    ```json
    {
        "id": 1,
        "name": "My Website",
        "type": "http",
        "url": "https://example.com",
        "method": "GET",
        "interval": 60,
        "retryInterval": 60,
        "resendInterval": 0,
        "maxretries": 0,
        "hostname": null,
        "port": null,
        "active": true,
        "tags": [
            {
                "tag_id": 1,
                "monitor_id": 1,
                "value": null,
                "name": "production",
                "color": "#059669"
            }
        ],
        "notificationIDList": { "1": true },
        // ... other monitor-type specific fields
        "accepted_statuscodes_json": "[\"200-299\"]",
        "conditions": "[]" // JSON string of condition groups
    }
    ```
-   **Heartbeat Object:**
    ```json
    {
        "monitorID": 1,
        "status": 1, // 0=DOWN, 1=UP, 2=PENDING, 3=MAINTENANCE
        "time": "2023-10-27T10:30:00.123Z", // ISO 8601 UTC Timestamp
        "msg": "OK",
        "ping": 123, // Response time in ms, null if not applicable
        "important": true, // Was this heartbeat a status change?
        "duration": 60, // Seconds since the last heartbeat for this monitor
        "localDateTime": "2023-10-27 12:30:00", // Formatted time in server's timezone
        "timezone": "Europe/Berlin", // Server's timezone name
        "retries": 0, // Number of retries attempted for this state
        "downCount": 0 // Consecutive down count for resend logic
    }
    ```
-   **Notification Object (Partial Example):**
    ```json
    {
        "id": 1,
        "name": "My Telegram Bot",
        "active": true,
        "isDefault": false,
        "userID": 1,
        "config": "{\"type\":\"telegram\",\"telegramBotToken\":\"...\",\"telegramChatID\":\"...\",\"name\":\"My Telegram Bot\",\"isDefault\":false,\"applyExisting\":false}" // JSON string
    }
    ```

## REST API Endpoints

---

### Push Endpoint

Receive updates for "Push" type monitors.

-   **Endpoint:** `/api/push/<pushToken>`
-   **Method:** `GET` | `POST` | `PUT` | `PATCH` (Method is generally ignored)
-   **Authentication:** Push Token (`<pushToken>` in the path)
-   **Path Parameters:**
    -   `pushToken` (string, required): The unique token associated with the push monitor.
-   **Query Parameters:**
    -   `status` (string, optional): Status of the service. `"up"` or `"down"`. Defaults to `"up"`.
    -   `msg` (string, optional): A message describing the status. Defaults to `"OK"`. Max length approx. 250 chars.
    -   `ping` (number, optional): Response time in milliseconds. Parsed as float. Defaults to `null`.
-   **Success Response (200 OK):**
    ```json
    {
        "ok": true
    }
    ```
-   **Error Response (404 Not Found):**
    ```json
    {
        "ok": false,
        "msg": "Monitor not found or not active."
    }
    ```

---

### Badge Endpoints

Provide status badges for monitors associated with a _public_ status page group.

-   **Status Badge:**

    -   **Endpoint:** `/api/badge/<id>/status`
    -   **Response:** SVG image.
    -   _(See previous documentation for query parameters)_

-   **Uptime Badge:**

    -   **Endpoint:** `/api/badge/<id>/uptime[/<duration>]` (e.g., `/uptime/24h`, `/uptime/7d`)
    -   **Response:** SVG image.
    -   _(See previous documentation for query parameters)_

-   **Ping/Response Time Badge:**

    -   **Endpoint:** `/api/badge/<id>/ping[/<duration>]` (e.g., `/ping/24h`, `/ping/7d`)
    -   **Response:** SVG image.
    -   _(See previous documentation for query parameters)_
    -   _Note: `/avg-response` and `/response` variants also exist._

-   **Certificate Expiry Badge:**
    -   **Endpoint:** `/api/badge/<id>/cert-exp`
    -   **Response:** SVG image.
    -   _(See previous documentation for query parameters)_

---

### Status Page Endpoints

Provide data for _published_ public status pages.

-   **Get Status Page Data:**

    -   **Endpoint:** `/api/status-page/<slug>`
    -   **Method:** `GET`
    -   **Authentication:** None (Requires Status Page to be published)
    -   **Path Parameters:**
        -   `slug` (string, required): The unique slug of the status page.
    -   **Success Response (200 OK):**
        ```json
        {
          "config": {  // StatusPage config object
            "slug": "my-status",
            "title": "My Service Status",
            "description": "Current status of our services.",
            "icon": "/icon.svg",
            "theme": "light",
            "published": true,
            "showTags": false,
            // ... other config fields
          },
          "incident": null | { // Pinned incident object or null
            "id": 1,
            "title": "Investigating Network Issues",
            "content": "We are currently investigating network latency.",
            "style": "warning",
            "createdDate": "2023-10-27T10:00:00.000Z",
            "lastUpdatedDate": "2023-10-27T10:15:00.000Z",
            "pin": true
          },
          "publicGroupList": [ // Array of public monitor groups
            {
              "id": 1,
              "name": "Core Services",
              "weight": 0,
              "monitorList": [ // Array of Monitor objects within the group
                {
                  "id": 1,
                  "name": "Website",
                  "type": "http",
                  // ... other *public* monitor fields
                },
                // ... more monitors
              ]
            },
            // ... more groups
          ],
          "maintenanceList": [ // Array of active/scheduled Maintenance objects relevant to this page
            {
                "id": 1,
                "title": "Scheduled Server Upgrade",
                "description": "Upgrading server hardware.",
                "strategy": "single", // or "recurring-...", "manual", "cron"
                "active": true,
                "status": "scheduled", // "scheduled", "under-maintenance", "ended", "inactive"
                "timeslotList": [
                    {
                        "startDate": "2023-11-01T02:00:00.000Z",
                        "endDate": "2023-11-01T04:00:00.000Z"
                    }
                    // ... more timeslots possible for recurring
                ],
                // ... other fields like timezone, weekdays etc.
            }
          ]
        }
        ```
    -   **Error Response (404 Not Found):** If slug doesn't exist or status page is not published.

-   **Get Status Page Heartbeats & Uptime:**

    -   **Endpoint:** `/api/status-page/heartbeat/<slug>`
    -   **Method:** `GET`
    -   **Authentication:** None (Requires Status Page to be published)
    -   **Path Parameters:**
        -   `slug` (string, required): The status page slug.
    -   **Success Response (200 OK):**
        ```json
        {
            "heartbeatList": {
                "1": [
                    // Monitor ID 1
                    { "status": 1, "time": "...", "msg": "OK", "ping": 55 }
                    // ... more heartbeats (up to 100 recent)
                ],
                "2": [
                    // Monitor ID 2
                    {
                        "status": 0,
                        "time": "...",
                        "msg": "Timeout",
                        "ping": null
                    }
                    // ...
                ]
            },
            "uptimeList": {
                "1_24": 0.9998, // Monitor ID 1, 24h uptime percentage
                "2_24": 0.95 // Monitor ID 2, 24h uptime percentage
                // ... potentially other periods if requested differently in future
            }
        }
        ```
    -   **Error Response (404 Not Found):** If slug doesn't exist or status page is not published.

-   **Get Status Page Manifest:**

    -   **Endpoint:** `/api/status-page/<slug>/manifest.json`
    -   **Method:** `GET`
    -   **Response:** Standard Web App Manifest JSON.
    -   _(See previous documentation for structure)_

-   **Get Overall Status Page Badge:**
    -   **Endpoint:** `/api/status-page/<slug>/badge`
    -   **Method:** `GET`
    -   **Response:** SVG image.
    -   _(See previous documentation for query parameters and logic)_

---

### Metrics Endpoint

Exposes internal metrics for Prometheus scraping.

-   **Endpoint:** `/metrics`
-   **Method:** `GET`
-   **Authentication:** API Key or Basic Auth (See Authentication section)
-   **Response:** Plain text in Prometheus exposition format. Includes gauges like:
    -   `monitor_status{monitor_name="...", monitor_type="...", ...}` (Value: 0, 1, 2, 3)
    -   `monitor_response_time{...}` (Value: milliseconds)
    -   `monitor_cert_days_remaining{...}` (Value: days)
    -   `monitor_cert_is_valid{...}` (Value: 0 or 1)

---

### Entry Page Endpoint

Used by the frontend to determine the initial landing page.

-   **Endpoint:** `/api/entry-page`
-   **Method:** `GET`
-   **Authentication:** None
-   **Success Response (200 OK):**
    -   If domain matches a status page:
        ```json
        { "type": "statusPageMatchedDomain", "statusPageSlug": "<your-slug>" }
        ```
    -   If standard entry:
        ```json
        { "type": "entryPage", "entryPage": "dashboard" | "statusPage-<your-slug>" }
        ```

## WebSocket API

Real-time interaction occurs over WebSockets after successful authentication.

### General Flow

1.  Client connects.
2.  Server may send `loginRequired`.
3.  Client sends `login` or `loginByToken`.
4.  Server responds via callback.
5.  If login OK, server sends initial data (`monitorList`, `heartbeatList`, etc.).
6.  Client sends commands (e.g., `addMonitor`, `pauseMonitor`), server responds via callback.
7.  Server pushes real-time updates (`heartbeat`, `avgPing`, `uptime`, list updates).

### Client-Sent Events (Selected Detail)

_(Format: `eventName`(data, callback(res)) )_

-   **Authentication:**

    -   `login`
        -   **Data:** `{ username: "<string>", password: "<string>", token?: "<string>" }` (2FA token if needed)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, token?: "<jwt_string>", tokenRequired?: <boolean> }`
        -   _Description:_ Attempts to log in. Returns `tokenRequired: true` if 2FA is enabled and token wasn't provided. Returns JWT `token` on success.
    -   `loginByToken`
        -   **Data:** `jwtToken: "<string>"`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean> }`
        -   _Description:_ Logs in using a previously obtained JWT.
    -   `logout`
        -   **Callback:** (Optional) `res: {}`
        -   _Description:_ Logs the current user out.

-   **Monitor Management:**

    -   `add`
        -   **Data:** `monitor: <MonitorObject>` (without `id`)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, monitorID?: <number> }`
        -   _Description:_ Adds a new monitor configuration.
    -   `editMonitor`
        -   **Data:** `monitor: <MonitorObject>` (with `id`)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, monitorID?: <number> }`
        -   _Description:_ Updates an existing monitor configuration.
    -   `deleteMonitor`
        -   **Data:** `monitorID: <number>`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean> }`
    -   `pauseMonitor` / `resumeMonitor`
        -   **Data:** `monitorID: <number>`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean> }`
    -   `getMonitor`
        -   **Data:** `monitorID: <number>`
        -   **Callback:** `res: { ok: <boolean>, monitor?: <MonitorObject>, msg?: "<string>" }`
    -   `getMonitorBeats`
        -   **Data:** `monitorID: <number>`, `period: <number>` (in hours)
        -   **Callback:** `res: { ok: <boolean>, data?: [<HeartbeatObject>], msg?: "<string>" }`
    -   `getMonitorChartData`
        -   **Data:** `monitorID: <number>`, `period: <number>` (in hours)
        -   **Callback:** `res: { ok: <boolean>, data?: [<UptimeCalculatorDataPoint>], msg?: "<string>" }`
        -   _Note:_ `<UptimeCalculatorDataPoint>` has fields like `timestamp`, `up`, `down`, `ping`, `pingMin`, `pingMax`.

-   **Notification Management:**

    -   `addNotification`
        -   **Data:** `notification: <NotificationObject>` (Config is stringified JSON), `notificationID: <number> | null` (null for add, ID for edit)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, id?: <number> }`
    -   `deleteNotification`
        -   **Data:** `notificationID: <number>`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean> }`
    -   `testNotification`
        -   **Data:** `notification: <NotificationObject>` (Config is stringified JSON)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>" }`

-   **Settings:**

    -   `getSettings`
        -   **Callback:** `res: { ok: <boolean>, data?: <object>, msg?: "<string>" }` (Data contains general settings)
    -   `setSettings`
        -   **Data:** `settings: <object>`, `currentPassword: "<string>"` (Required only if enabling auth or changing sensitive settings while auth is on)
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean> }`
    -   `changePassword`
        -   **Data:** `passwords: { currentPassword: "<string>", newPassword: "<string>" }`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, token?: "<jwt_string>" }`

-   **Status Page Management:**

    -   `addStatusPage`
        -   **Data:** `title: "<string>"`, `slug: "<string>"`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", msgi18n?: <boolean>, slug?: "<string>" }`
    -   `saveStatusPage`
        -   **Data:** `slug: "<string>"`, `config: <StatusPageConfigObject>`, `imgDataUrl: "<string>"`, `publicGroupList: [<PublicGroupObject>]`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>", publicGroupList?: [<PublicGroupObject>] }`
    -   `deleteStatusPage`
        -   **Data:** `slug: "<string>"`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>" }`
    -   `postIncident`
        -   **Data:** `slug: "<string>"`, `incident: <IncidentObject>`
        -   **Callback:** `res: { ok: <boolean>, incident?: <IncidentObject>, msg?: "<string>" }`
    -   `unpinIncident`
        -   **Data:** `slug: "<string>"`
        -   **Callback:** `res: { ok: <boolean>, msg?: "<string>" }`

-   _(Other events for Maintenance, API Keys, Tags, Proxies, Docker, Remote Browsers, 2FA, Database actions follow a similar pattern: send data object, receive `{ ok: ..., msg: ... }` via callback)_

### Server-Sent Events (Selected Detail)

-   `monitorList`
    -   **Payload:** `{ <monitorID>: <MonitorObject>, ... }`
    -   _Description:_ Full list of monitors the user has access to. Sent on connect/login or major list change.
-   `updateMonitorIntoList`
    -   **Payload:** `{ <monitorID>: <MonitorObject>, ... }`
    -   _Description:_ Updated data for one or more specific monitors.
-   `deleteMonitorFromList`
    -   **Payload:** `monitorID: <number>`
    -   _Description:_ Sent when a monitor is deleted.
-   `heartbeat`
    -   **Payload:** `<HeartbeatObject>`
    -   _Description:_ Real-time heartbeat update for a monitor.
-   `avgPing`
    -   **Payload:** `monitorID: <number>`, `avgPing: <number> | null`
    -   _Description:_ Updated 24-hour average ping.
-   `uptime`
    -   **Payload:** `monitorID: <number>`, `periodKey: "<string>"`, `percentage: <number>` (e.g., periodKey "24" for 24h uptime)
    -   _Description:_ Updated uptime percentage for a specific period.
-   `certInfo`
    -   **Payload:** `monitorID: <number>`, `tlsInfoJSON: "<string>"` (JSON string of TLS details)
    -   _Description:_ Updated TLS certificate information.
-   _(Other list events `notificationList`, `maintenanceList`, etc. send arrays or objects representing the respective items.)_
-   `refresh`
    -   _Description:_ Tells the client UI to reload the page (e.g., after password change).
-   `info`
    -   **Payload:** `{ version: "<string>", latestVersion: "<string>", primaryBaseURL: "<string>", serverTimezone: "<string>" }`
    -   _Description:_ Basic server information.

### Error Handling

-   Most callback responses (`res`) from client-sent events will include `ok: false` and a `msg` property containing an error description if the operation failed on the server-side. The `msgi18n` flag indicates if the `msg` is an i18n key.
-   Connection errors (`connect_error`, `disconnect`) are handled by the client to show appropriate messages.

_Disclaimer: This documentation is generated based on analysis of the provided source code. While aiming for accuracy, it might not cover every implementation detail or edge case. Always refer to the source code for definitive behavior._
