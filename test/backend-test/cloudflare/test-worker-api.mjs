import { describe, test } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Cloudflare Worker API", () => {
    test("D1 migration creates network profiles and heartbeat-compatible tables", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0001_network_profiles.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS network_profiles/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitors/);
        assert.match(migrationSql, /network_profile_id TEXT/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS heartbeats/);
        assert.match(migrationSql, /idx_monitors_active_interval ON monitors\(active, "interval"\)/);
        assert.match(migrationSql, /INSERT OR IGNORE INTO network_profiles/);
        assert.match(migrationSql, /'twingate'/);
    });

    test("D1 migration adds monitor config JSON for edit form fields", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0003_monitor_config_json.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /ALTER TABLE monitors ADD COLUMN config_json TEXT/);
    });

    test("D1 migration adds monitor parent relationships for groups", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0004_monitor_parent.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /ALTER TABLE monitors ADD COLUMN parent INTEGER/);
        assert.match(migrationSql, /idx_monitors_parent ON monitors\(parent\)/);
    });

    test("D1 migration creates lightweight app settings table", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0002_app_settings.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS app_settings/);
        assert.match(migrationSql, /key TEXT PRIMARY KEY/);
        assert.match(migrationSql, /value TEXT NOT NULL/);
    });

    test("D1 migration creates notification settings tables", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0005_notifications.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS notification/);
        assert.match(migrationSql, /config TEXT/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitor_notification/);
        assert.match(migrationSql, /monitor_notification_index/);
    });

    test("Worker deployment serves the Vue web UI as a single-page app", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

        assert.deepStrictEqual(wranglerConfig.assets, {
            directory: "./dist/",
            not_found_handling: "single-page-application",
            binding: "ASSETS",
            run_worker_first: ["/api/*"],
        });
        assert.strictEqual(wranglerConfig.keep_vars, true);
    });

    test("Worker Twingate config does not expose a configurable proxy URL", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

        assert.ok(wranglerConfig.vars);
        assert.strictEqual("TWINGATE_PROXY_URL" in wranglerConfig.vars, false);
        assert.strictEqual(wranglerConfig.vars.TWINGATE_NETWORK, "wgs.twingate.com");
        assert.strictEqual(
            wranglerConfig.vars.TWINGATE_SERVICE_ACCOUNT_ID,
            "72b53d66-51da-4b90-9f61-4c8bfd83b2a6"
        );
        assert.strictEqual(
            wranglerConfig.vars.TWINGATE_KEY_ID,
            "O0ORCtbn8BPjempoVgaW7KDypjrscs-7U8B7bp1jGqU"
        );
        assert.strictEqual("TWINGATE_PRIVATE_KEY" in wranglerConfig.vars, false);
        assert.strictEqual(wranglerConfig.vars.TWINGATE_TUN, "on");
    });

    test("Worker admin API accepts the configured Cloudflare Access application", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

        assert.strictEqual(wranglerConfig.vars.CF_ACCESS_TEAM_DOMAIN, "https://wgs.cloudflareaccess.com");
        const audiences = wranglerConfig.vars.CF_ACCESS_AUD.split(",");
        assert.ok(audiences.includes("e06744dbe3c5a7aa46503b6e518b0fbfb7f6ff38cfc751f5f5a4bfc56974fae6"));
        assert.ok(audiences.includes("31798319d7ee654c37ed0a90f07e7c26d87cdbe50014aaa1718b13d195101734"));
    });

    test("runner container image includes Twingate lifecycle helper", async () => {
        const dockerfilePath = path.join(__dirname, "../../../cloudflare/runner/Dockerfile");
        const dockerfile = fs.readFileSync(dockerfilePath, "utf8");

        assert.match(dockerfile, /COPY checker\.js server\.js twingate-lifecycle\.js twingate-service-key\.js \.\//);
    });

    test("runner container receives extended Twingate readiness timeout env", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /TWINGATE_READY_TIMEOUT_MS:\s*"60000"/);
        assert.match(workerSource, /"TWINGATE_READY_TIMEOUT_MS"/);
        assert.match(workerSource, /"TWINGATE_TUN"/);
        assert.match(workerSource, /JSON\.stringify\(value\)/);
    });

    test("entry page routes the deployed web UI to the dashboard", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(new Request("https://example.com/api/entry-page"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { type: "entryPage", entryPage: "dashboard" });
    });

    test("requires bearer auth for Worker admin API routes", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(new Request("https://example.com/api/monitors"), env);

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
    });

    test("accepts authenticated Cloudflare Access users for Worker admin API routes", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const accessAuth = await createAccessAuth();
        const env = createEnv({
            adminToken: "",
            accessAuth,
            monitors: [],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    "cf-access-jwt-assertion": accessAuth.token,
                },
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { monitors: [] });
    });

    test("accepts authenticated Cloudflare Access users from any configured audience", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const accessAuth = await createAccessAuth({ audience: "custom-domain-aud" });
        const env = createEnv({
            adminToken: "",
            accessAuth,
            accessAudience: "workers-dev-aud,custom-domain-aud",
            monitors: [],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    "cf-access-jwt-assertion": accessAuth.token,
                },
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { monitors: [] });
    });

    test("fails closed when Worker admin token is not configured", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({ adminToken: "" });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);

        assert.strictEqual(response.status, 503);
        assert.deepStrictEqual(await response.json(), { error: "Admin API token is not configured" });
    });

    test("lists the Worker default status page for the deployed web UI", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(new Request("https://example.com/api/status-pages"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(Object.keys(body.statusPages), ["1"]);
        assert.strictEqual(body.statusPages[1].slug, "default");
        assert.strictEqual(body.statusPages[1].icon, "/icon.svg");
    });

    test("serves Worker status page data from D1 monitors", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: null,
                    body: null,
                    keyword: null,
                    json_path: "$",
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: null,
                },
            ],
        });

        const response = await handleApiRequest(new Request("https://example.com/api/status-page/default"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.config.slug, "default");
        assert.strictEqual(body.publicGroupList.length, 1);
        assert.strictEqual(body.publicGroupList[0].monitorList.length, 1);
        assert.strictEqual(body.publicGroupList[0].monitorList[0].name, "Private HTTP");
        assert.strictEqual(body.publicGroupList[0].monitorList[0].sendUrl, true);
        assert.deepStrictEqual(body.maintenanceList, []);
    });

    test("serves Worker status page heartbeat data", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: null,
                    body: null,
                    keyword: null,
                    json_path: "$",
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: null,
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "Timeout",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/status-page/heartbeat/default"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(
            body.heartbeatList[7].map((heartbeat) => heartbeat.time),
            ["2026-05-11 02:30:00", "2026-05-11 02:31:00"]
        );
        assert.strictEqual(body.uptimeList["7_24"], 0.5);
    });

    test("lists monitors with their latest heartbeat for the deployed web UI", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: "{\"x-test\":\"true\"}",
                    body: "",
                    keyword: null,
                    json_path: "$",
                    expected_value: null,
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: "twingate",
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.length, 1);
        assert.deepStrictEqual(
            pick(body.monitors[0], [
                "id",
                "name",
                "type",
                "url",
                "method",
                "timeout",
                "interval",
                "maxretries",
                "retryInterval",
                "resendInterval",
                "accepted_statuscodes",
                "networkProfileId",
                "lastHeartbeat",
            ]),
            {
                id: 7,
                name: "Private HTTP",
                type: "http",
                url: "http://private.example.test",
                method: "GET",
                timeout: 30,
                interval: 60,
                maxretries: 0,
                retryInterval: 60,
                resendInterval: 0,
                accepted_statuscodes: ["200-299"],
                networkProfileId: "twingate",
                lastHeartbeat: {
                    monitorID: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    time: "2026-05-11 02:30:00",
                },
            }
        );
    });

    test("lists Worker monitors with upside-down latest heartbeat status applied", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Expected Down HTTP",
                    type: "http",
                    url: "https://example.test",
                    active: 1,
                    config_json: JSON.stringify({ upsideDown: true }),
                },
                {
                    id: 8,
                    name: "Expected Up HTTP",
                    type: "http",
                    url: "https://offline.example.test",
                    active: 1,
                    config_json: JSON.stringify({ upsideDown: true }),
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    monitor_id: 8,
                    status: 0,
                    ping: null,
                    msg: "Timeout",
                    checked_at: "2026-05-11 02:30:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.find((monitor) => monitor.id === 7).lastHeartbeat.status, 0);
        assert.strictEqual(body.monitors.find((monitor) => monitor.id === 8).lastHeartbeat.status, 1);
    });

    test("lists monitors when the config_json migration has not run yet", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            missingConfigJsonColumn: true,
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: null,
                    body: null,
                    keyword: null,
                    json_path: "$",
                    expected_value: null,
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: null,
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.length, 1);
        assert.strictEqual(body.monitors[0].name, "Private HTTP");
        assert.deepStrictEqual(body.monitors[0].accepted_statuscodes, ["200-299"]);
    });

    test("gets and saves UI settings through app_settings", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                entryPage: "dashboard",
                searchEngineIndex: false,
            },
        });

        const getResponse = await handleApiRequest(adminRequest("https://example.com/api/settings"), env);
        const getBody = await getResponse.json();

        assert.strictEqual(getResponse.status, 200);
        assert.strictEqual(getBody.data.entryPage, "dashboard");
        assert.strictEqual(getBody.data.checkUpdate, true);
        assert.strictEqual(getBody.data.keepDataPeriodDays, 180);

        const putResponse = await handleApiRequest(
            adminRequest("https://example.com/api/settings", {
                method: "PUT",
                body: JSON.stringify({
                    primaryBaseURL: "https://uptime.example.com",
                    searchEngineIndex: true,
                }),
            }),
            env
        );

        assert.strictEqual(putResponse.status, 200);
        assert.deepStrictEqual(await putResponse.json(), { ok: true, msg: "Settings saved" });
        assert.strictEqual(env.state.settings.primaryBaseURL, "https://uptime.example.com");
        assert.strictEqual(env.state.settings.searchEngineIndex, true);
    });

    test("creates, lists, updates, and deletes Worker notification configs", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Example",
                    type: "http",
                    url: "https://example.com",
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: null,
                },
            ],
        });

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/notifications", {
                method: "POST",
                body: JSON.stringify({
                    type: "discord",
                    name: "Discord Alerts",
                    webhookUrl: "https://example.com/webhook",
                    isDefault: true,
                    applyExisting: true,
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.strictEqual(createBody.id, 1);
        assert.deepStrictEqual(env.state.monitorNotifications, [{ monitor_id: 7, notification_id: 1 }]);

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/notifications"), env);
        const listBody = await listResponse.json();

        assert.strictEqual(listResponse.status, 200);
        assert.strictEqual(listBody.notifications.length, 1);
        assert.strictEqual(listBody.notifications[0].name, "Discord Alerts");
        assert.strictEqual(listBody.notifications[0].isDefault, true);
        assert.strictEqual(JSON.parse(listBody.notifications[0].config).applyExisting, false);

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/notifications/1", {
                method: "PUT",
                body: JSON.stringify({
                    type: "discord",
                    name: "Primary Discord",
                    isDefault: false,
                }),
            }),
            env
        );

        assert.strictEqual(updateResponse.status, 200);
        assert.strictEqual(env.state.notifications[0].name, "Primary Discord");
        assert.strictEqual(env.state.notifications[0].is_default, 0);

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/notifications/1", { method: "DELETE" }),
            env
        );

        assert.strictEqual(deleteResponse.status, 200);
        assert.strictEqual(env.state.notifications.length, 0);
        assert.strictEqual(env.state.monitorNotifications.length, 0);
    });

    test("self-heals missing notification tables before listing Worker notifications", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            missingNotificationTables: true,
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/notifications"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { notifications: [] });
        assert.strictEqual(env.state.missingNotificationTables, false);
    });

    test("self-heals missing notification tables before saving Worker notifications", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            missingNotificationTables: true,
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/notifications", {
                method: "POST",
                body: JSON.stringify({
                    type: "webhook",
                    name: "Webhook Alerts",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(env.state.notifications.length, 1);
        assert.strictEqual(env.state.notifications[0].name, "Webhook Alerts");
        assert.strictEqual(env.state.missingNotificationTables, false);
    });

    test("creates, reads, updates, toggles, and deletes a supported monitor", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors", {
                method: "POST",
                body: JSON.stringify({
                    name: "Example HTTP",
                    type: "http",
                    url: "https://example.com",
                    interval: 90,
                    timeout: 20,
                    networkProfileId: null,
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.strictEqual(createBody.ok, true);
        assert.strictEqual(createBody.monitorID, 1);

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual(readBody.monitor.name, "Example HTTP");
        assert.strictEqual(readBody.monitor.interval, 90);

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1", {
                method: "PUT",
                body: JSON.stringify({
                    ...readBody.monitor,
                    name: "Renamed HTTP",
                    method: "POST",
                    body: "{\"ok\":true}",
                }),
            }),
            env
        );

        assert.strictEqual(updateResponse.status, 200);
        assert.deepStrictEqual(await updateResponse.json(), { ok: true, msg: "Monitor saved" });
        assert.strictEqual(env.state.monitors[0].name, "Renamed HTTP");
        assert.strictEqual(env.state.monitors[0].method, "POST");

        const pauseResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1/active", {
                method: "PATCH",
                body: JSON.stringify({ active: false }),
            }),
            env
        );
        assert.strictEqual(pauseResponse.status, 200);
        assert.deepStrictEqual(await pauseResponse.json(), { ok: true, active: false });
        assert.strictEqual(env.state.monitors[0].active, 0);

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1", { method: "DELETE" }),
            env
        );
        assert.strictEqual(deleteResponse.status, 200);
        assert.deepStrictEqual(await deleteResponse.json(), { ok: true, msg: "Deleted" });
        assert.strictEqual(env.state.monitors.length, 0);
    });

    test("round-trips Worker edit form fields that are not runner columns", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors", {
                method: "POST",
                body: JSON.stringify({
                    name: "Editable HTTP",
                    type: "json-query",
                    url: "https://example.com/health",
                    interval: 90,
                    timeout: 20,
                    maxretries: 4,
                    retryInterval: 30,
                    resendInterval: 6,
                    retryOnlyOnStatusCodeFailure: true,
                    accepted_statuscodes: ["200-299", "418"],
                    ignoreTls: true,
                    upsideDown: true,
                    expiryNotification: false,
                    domainExpiryNotification: false,
                    cacheBust: true,
                    maxredirects: 3,
                    saveResponse: true,
                    saveErrorResponse: true,
                    responseMaxLength: 2048,
                    authMethod: "basic",
                    basic_auth_user: "worker-user",
                    basic_auth_pass: "worker-pass",
                    jsonPathOperator: "contains",
                    ipFamily: "ipv4",
                }),
            }),
            env
        );
        assert.strictEqual(createResponse.status, 200);

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual(readBody.monitor.maxretries, 4);
        assert.strictEqual(readBody.monitor.retryInterval, 30);
        assert.strictEqual(readBody.monitor.resendInterval, 6);
        assert.strictEqual(readBody.monitor.retryOnlyOnStatusCodeFailure, true);
        assert.deepStrictEqual(readBody.monitor.accepted_statuscodes, ["200-299", "418"]);
        assert.strictEqual(readBody.monitor.ignoreTls, true);
        assert.strictEqual(readBody.monitor.upsideDown, true);
        assert.strictEqual(readBody.monitor.cacheBust, true);
        assert.strictEqual(readBody.monitor.maxredirects, 3);
        assert.strictEqual(readBody.monitor.saveResponse, true);
        assert.strictEqual(readBody.monitor.saveErrorResponse, true);
        assert.strictEqual(readBody.monitor.responseMaxLength, 2048);
        assert.strictEqual(readBody.monitor.authMethod, "basic");
        assert.strictEqual(readBody.monitor.basic_auth_user, "worker-user");
        assert.strictEqual(readBody.monitor.basic_auth_pass, "worker-pass");
        assert.strictEqual(readBody.monitor.jsonPathOperator, "contains");
        assert.strictEqual(readBody.monitor.ipFamily, "ipv4");

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1", {
                method: "PUT",
                body: JSON.stringify({
                    ...readBody.monitor,
                    name: "Still Editable HTTP",
                    maxretries: 5,
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);

        const rereadResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const rereadBody = await rereadResponse.json();
        assert.strictEqual(rereadBody.monitor.name, "Still Editable HTTP");
        assert.strictEqual(rereadBody.monitor.maxretries, 5);
        assert.strictEqual(rereadBody.monitor.retryInterval, 30);
        assert.strictEqual(rereadBody.monitor.resendInterval, 6);
        assert.deepStrictEqual(rereadBody.monitor.accepted_statuscodes, ["200-299", "418"]);
        assert.strictEqual(rereadBody.monitor.basic_auth_user, "worker-user");
        assert.strictEqual(rereadBody.monitor.basic_auth_pass, "worker-pass");
    });

    test("accepts Ping worker monitor types", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerResult: { status: 1, ping: 12.345, msg: "12.345 ms", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors", {
                method: "POST",
                body: JSON.stringify({
                    name: "Ping",
                    type: "ping",
                    hostname: "example.com",
                    ping_count: 3,
                    ping_per_request_timeout: 2,
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(env.state.monitors[0].type, "ping");
        assert.strictEqual(env.state.monitors[0].hostname, "example.com");

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readBody.monitor.type, "ping");
        assert.strictEqual(readBody.monitor.hostname, "example.com");
        assert.strictEqual(readBody.monitor.ping_count, 3);
        assert.strictEqual(readBody.monitor.ping_per_request_timeout, 2);

        const checkResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1/check-now", { method: "POST" }),
            env
        );
        assert.strictEqual(checkResponse.status, 200);
        assert.deepStrictEqual(env.state.runnerJobs[0].monitor, {
            id: 1,
            name: "Ping",
            type: "ping",
            url: null,
            hostname: "example.com",
            port: null,
            method: "GET",
            headers: null,
            body: null,
            keyword: null,
            invertKeyword: false,
            jsonPath: "$",
            expectedValue: null,
            timeout: 30,
            packetSize: 56,
            ping_count: 3,
            ping_numeric: true,
            ping_per_request_timeout: 2,
        });
    });

    test("rejects unsupported Worker monitor types", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors", {
                method: "POST",
                body: JSON.stringify({
                    name: "Unsupported",
                    type: "dns",
                    hostname: "example.com",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 400);
        assert.deepStrictEqual(await response.json(), {
            error: "Monitor type dns is not supported by the Cloudflare Worker UI",
        });
    });

    test("imports group monitors and preserves child parent relationships", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            id: 10,
                            name: "Websites",
                            type: "group",
                            active: 1,
                        },
                        {
                            id: 11,
                            name: "Public Site",
                            type: "http",
                            url: "https://www.example.com",
                            parent: 10,
                            active: 1,
                        },
                        {
                            id: 12,
                            name: "Nested Group",
                            type: "group",
                            parent: 10,
                            active: 1,
                        },
                        {
                            id: 13,
                            name: "Nested Site",
                            type: "http",
                            url: "https://nested.example.com",
                            parent: 12,
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 4);
        const websites = env.state.monitors.find((monitor) => monitor.name === "Websites");
        const publicSite = env.state.monitors.find((monitor) => monitor.name === "Public Site");
        const nestedGroup = env.state.monitors.find((monitor) => monitor.name === "Nested Group");
        const nestedSite = env.state.monitors.find((monitor) => monitor.name === "Nested Site");
        assert.strictEqual(websites.type, "group");
        assert.strictEqual(websites.parent, null);
        assert.strictEqual(publicSite.parent, websites.id);
        assert.strictEqual(nestedGroup.parent, websites.id);
        assert.strictEqual(nestedSite.parent, nestedGroup.id);

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const listBody = await listResponse.json();
        const byName = Object.fromEntries(listBody.monitors.map((monitor) => [monitor.name, monitor]));

        assert.deepStrictEqual(byName.Websites.childrenIDs.toSorted((a, b) => a - b), [
            publicSite.id,
            nestedGroup.id,
            nestedSite.id,
        ].toSorted((a, b) => a - b));
        assert.deepStrictEqual(byName["Nested Group"].childrenIDs, [nestedSite.id]);
        assert.strictEqual(byName["Public Site"].parent, websites.id);
        assert.deepStrictEqual(byName["Public Site"].path, ["Websites", "Public Site"]);
        assert.strictEqual(byName["Public Site"].pathName, "Websites / Public Site");
        assert.strictEqual(byName["Nested Site"].parent, nestedGroup.id);
        assert.deepStrictEqual(byName["Nested Site"].path, ["Websites", "Nested Group", "Nested Site"]);
    });

    test("imports grouped monitors after self-healing an older D1 schema without parent", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({ missingParentColumn: true });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            id: 10,
                            name: "Websites",
                            type: "group",
                            active: 1,
                        },
                        {
                            id: 11,
                            name: "Public Site",
                            type: "http",
                            url: "https://www.example.com",
                            parent: 10,
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 2);
        assert.strictEqual(env.state.missingParentColumn, false);

        const websites = env.state.monitors.find((monitor) => monitor.name === "Websites");
        const publicSite = env.state.monitors.find((monitor) => monitor.name === "Public Site");
        assert.strictEqual(publicSite.parent, websites.id);
    });

    test("creates missing groups from Uptime Kuma path metadata during import", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            id: 21,
                            name: "Node 4",
                            type: "ping",
                            hostname: "node4.example.com",
                            path: ["Corporate", "Node 4"],
                            active: 1,
                        },
                        {
                            id: 22,
                            name: "Security Check",
                            type: "http",
                            url: "https://accounting.example.com/health",
                            path: ["Sites", "Accounting", "Security Check"],
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 5);
        assert.strictEqual(env.state.monitors.length, 5);

        const byName = Object.fromEntries(env.state.monitors.map((monitor) => [monitor.name, monitor]));
        assert.strictEqual(byName.Corporate.type, "group");
        assert.strictEqual(byName["Node 4"].parent, byName.Corporate.id);
        assert.strictEqual(byName.Sites.type, "group");
        assert.strictEqual(byName.Accounting.type, "group");
        assert.strictEqual(byName.Accounting.parent, byName.Sites.id);
        assert.strictEqual(byName["Security Check"].parent, byName.Accounting.id);

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const listBody = await listResponse.json();
        const listedByName = Object.fromEntries(listBody.monitors.map((monitor) => [monitor.name, monitor]));
        assert.deepStrictEqual(listedByName["Node 4"].path, ["Corporate", "Node 4"]);
        assert.deepStrictEqual(listedByName["Security Check"].path, ["Sites", "Accounting", "Security Check"]);
    });

    test("reuses existing groups when importing Uptime Kuma path metadata in skip mode", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Corporate",
                    type: "group",
                    parent: null,
                    active: 1,
                },
            ],
            nextMonitorId: 8,
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    importHandle: "skip",
                    monitors: [
                        {
                            id: 31,
                            name: "Node 4",
                            type: "ping",
                            hostname: "node4.example.com",
                            pathName: "Corporate / Node 4",
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 1);
        assert.strictEqual(body.skipped, 1);
        assert.strictEqual(env.state.monitors.filter((monitor) => monitor.name === "Corporate").length, 1);

        const imported = env.state.monitors.find((monitor) => monitor.name === "Node 4");
        assert.strictEqual(imported.parent, 7);
    });

    test("infers group parents for flat Uptime Kuma exports with group rows", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        { name: "Archive", type: "group", active: 0 },
                        { name: "Endpoints", type: "group", active: 1 },
                        { name: "Internet", type: "group", active: 1 },
                        { name: "Nodes", type: "group", active: 1 },
                        { name: "Printers", type: "group", active: 1 },
                        { name: "Security", type: "group", active: 1 },
                        { name: "Timeclock", type: "group", active: 1 },
                        { name: "Websites", type: "group", active: 1 },
                        {
                            name: "Dort 3 - Shipping Computer",
                            type: "ping",
                            hostname: "shipping.example.com",
                            active: 0,
                        },
                        {
                            name: "Sales OS - Security Check",
                            type: "http",
                            url: "https://sales.example.com",
                            active: 1,
                        },
                        {
                            name: "Ring - Timeclock",
                            type: "ping",
                            hostname: "timeclock.example.com",
                            active: 1,
                        },
                        {
                            name: "Dort 3 - Lexmark",
                            type: "ping",
                            hostname: "printer.example.com",
                            active: 1,
                        },
                        {
                            name: "Corporate | Node 4",
                            type: "ping",
                            hostname: "node4.example.com",
                            active: 1,
                        },
                        {
                            name: "Corporate | T-Mobile 5G",
                            type: "ping",
                            hostname: "cellular.example.com",
                            active: 1,
                        },
                        {
                            name: "Sales OS",
                            type: "http",
                            url: "https://sales.example.com",
                            active: 1,
                        },
                        {
                            name: "Conference Computer",
                            type: "port",
                            hostname: "conference.example.com",
                            port: 3389,
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 16);
        assert.strictEqual(env.state.monitors.filter((monitor) => monitor.type === "group").length, 8);

        const byName = Object.fromEntries(env.state.monitors.map((monitor) => [monitor.name, monitor]));
        assert.strictEqual(byName["Dort 3 - Shipping Computer"].parent, byName.Archive.id);
        assert.strictEqual(byName["Sales OS - Security Check"].parent, byName.Security.id);
        assert.strictEqual(byName["Ring - Timeclock"].parent, byName.Timeclock.id);
        assert.strictEqual(byName["Dort 3 - Lexmark"].parent, byName.Printers.id);
        assert.strictEqual(byName["Corporate | Node 4"].parent, byName.Nodes.id);
        assert.strictEqual(byName["Corporate | T-Mobile 5G"].parent, byName.Internet.id);
        assert.strictEqual(byName["Sales OS"].parent, byName.Websites.id);
        assert.strictEqual(byName["Conference Computer"].parent, byName.Endpoints.id);
    });

    test("does not create placeholder groups for missing parent IDs without hierarchy metadata", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            id: 41,
                            name: "Orphan HTTP",
                            type: "http",
                            url: "https://orphan.example.com",
                            parent: 999,
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 1);
        assert.strictEqual(env.state.monitors.length, 1);
        assert.strictEqual(env.state.monitors[0].parent, null);
        assert.match(body.results[0].reason, /Parent monitor 999 was not found/);
    });

    test("imports supported monitors from an Uptime Kuma backup and reports skipped rows", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Existing HTTP",
                    type: "http",
                    url: "https://existing.example.com",
                    active: 1,
                },
            ],
            nextMonitorId: 8,
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    importHandle: "skip",
                    backup: {
                        version: "2.0.0",
                        monitorList: {
                            1: {
                                name: "Existing HTTP",
                                type: "http",
                                url: "https://duplicate.example.com",
                            },
                            2: {
                                name: "Imported Keyword",
                                type: "keyword",
                                url: "https://example.com/health",
                                method: "POST",
                                headers: "{\"x-test\":\"true\"}",
                                body: "{\"probe\":true}",
                                keyword: "ok",
                                invertKeyword: true,
                                timeout: 12,
                                interval: 45,
                                active: false,
                                accepted_statuscodes: ["200-299", "418"],
                                maxretries: 3,
                                basic_auth_user: "probe-user",
                                basic_auth_pass: "probe-pass",
                            },
                            3: {
                                name: "Imported DNS",
                                type: "dns",
                                hostname: "example.com",
                            },
                        },
                    },
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(
            pick(body, ["ok", "imported", "skipped", "unsupported", "total"]),
            {
                ok: true,
                imported: 1,
                skipped: 1,
                unsupported: 1,
                total: 3,
            }
        );
        assert.strictEqual(body.results[0].status, "skipped");
        assert.strictEqual(body.results[1].status, "imported");
        assert.strictEqual(body.results[2].reason, "Unsupported monitor type: dns");
        assert.strictEqual(env.state.monitors.length, 2);

        const imported = env.state.monitors.find((monitor) => monitor.name === "Imported Keyword");
        assert.strictEqual(imported.id, 8);
        assert.strictEqual(imported.type, "keyword");
        assert.strictEqual(imported.url, "https://example.com/health");
        assert.strictEqual(imported.method, "POST");
        assert.strictEqual(imported.keyword, "ok");
        assert.strictEqual(imported.invert_keyword, 1);
        assert.strictEqual(imported.timeout, 12);
        assert.strictEqual(imported.interval, 45);
        assert.strictEqual(imported.active, 0);
        assert.deepStrictEqual(JSON.parse(imported.config_json).accepted_statuscodes, ["200-299", "418"]);
        assert.strictEqual(JSON.parse(imported.config_json).basic_auth_user, "probe-user");
    });

    test("can replace an existing monitor while importing an Uptime Kuma backup", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 12,
                    name: "Existing HTTP",
                    type: "http",
                    url: "https://old.example.com",
                    active: 1,
                },
            ],
            heartbeats: [
                { monitor_id: 12, status: 1, ping: 10, msg: "200 - OK" },
            ],
            nextMonitorId: 13,
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    importHandle: "overwrite",
                    monitors: [
                        {
                            name: "Existing HTTP",
                            type: "http",
                            url: "https://new.example.com",
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 1);
        assert.strictEqual(body.overwritten, 1);
        assert.strictEqual(env.state.monitors.length, 1);
        assert.strictEqual(env.state.monitors[0].id, 13);
        assert.strictEqual(env.state.monitors[0].url, "https://new.example.com");
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("normalizes Uptime Kuma v2 monitor export fields for Worker import", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            name: "Conference Computer",
                            type: "port",
                            url: "https://",
                            hostname: "203.0.113.10",
                            port: 443,
                            active: 1,
                            accepted_statuscodes: "[\"200-299\"]",
                            ignoreTls: 0,
                            upsideDown: 1,
                            expiryNotification: 0,
                            domainExpiryNotification: 1,
                            cacheBust: 0,
                            ping_numeric: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 1);
        assert.strictEqual(env.state.monitors[0].url, null);

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();

        assert.deepStrictEqual(readBody.monitor.accepted_statuscodes, ["200-299"]);
        assert.strictEqual(readBody.monitor.ignoreTls, false);
        assert.strictEqual(readBody.monitor.upsideDown, true);
        assert.strictEqual(readBody.monitor.expiryNotification, false);
        assert.strictEqual(readBody.monitor.domainExpiryNotification, true);
        assert.strictEqual(readBody.monitor.cacheBust, false);
        assert.strictEqual(readBody.monitor.ping_numeric, true);
    });

    test("routes imported private network monitors through Twingate by default", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            name: "Conference Room Phone",
                            type: "ping",
                            hostname: "192.168.1.20",
                            active: 1,
                        },
                        {
                            name: "Tell City Timeclock",
                            type: "port",
                            hostname: "10.10.4.15",
                            port: 4370,
                            active: 1,
                        },
                    ],
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.imported, 2);
        assert.strictEqual(body.failed, 0);
        assert.deepStrictEqual(
            env.state.monitors.map((monitor) => monitor.network_profile_id),
            ["twingate", "twingate"]
        );
    });

    test("lists and clears monitor heartbeats", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [{ id: 7, name: "Private HTTP", type: "http", active: 1 }],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: 44,
                    msg: "500 - Error",
                    checked_at: "2026-05-11 02:00:00",
                },
                {
                    monitor_id: 8,
                    status: 1,
                    ping: 7,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 01:00:00",
                },
            ],
        });

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/7/heartbeats"), env);
        const listBody = await listResponse.json();

        assert.strictEqual(listResponse.status, 200);
        assert.deepStrictEqual(listBody, {
            count: 2,
            heartbeats: [
                {
                    monitorID: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    time: "2026-05-11 02:30:00",
                },
                {
                    monitorID: 7,
                    status: 0,
                    ping: 44,
                    msg: "500 - Error",
                    time: "2026-05-11 02:00:00",
                },
            ],
        });

        const clearResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/heartbeats", { method: "DELETE" }),
            env
        );

        assert.strictEqual(clearResponse.status, 200);
        assert.deepStrictEqual(await clearResponse.json(), { ok: true, msg: "Heartbeats cleared" });
        assert.deepStrictEqual(env.state.heartbeats.map((heartbeat) => heartbeat.monitor_id), [8]);
    });

    test("lists Worker monitor history with upside-down statuses applied", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Expected Down HTTP",
                    type: "http",
                    active: 1,
                    config_json: JSON.stringify({ upsideDown: true }),
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: 44,
                    msg: "500 - Error",
                    checked_at: "2026-05-11 02:00:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors/7/heartbeats"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.heartbeats.map((heartbeat) => heartbeat.status), [0, 1]);
    });

    test("lists direct and Twingate network profiles", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/network-profiles"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.profiles, [
            { id: null, slug: "direct", name: "Direct", type: "direct", enabled: true },
            { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: true },
        ]);
    });

    test("returns Twingate runner startup status", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerStatus: {
                configured: true,
                starting: true,
                running: false,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "on",
                lastError: null,
                serviceKeyInspection: {
                    validJson: true,
                    fields: {
                        version: true,
                        network: true,
                        service_account_id: true,
                        key_id: true,
                        private_key: true,
                        login_path: true,
                    },
                    privateKeyShape: {
                        length: 58,
                        startsWithPemHeader: true,
                        endsWithPemFooter: true,
                        containsLiteralBackslashN: false,
                        containsRealNewline: true,
                        sha256Prefix: "123456789abc",
                    },
                },
            },
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/twingate/status"), env);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: null,
        });
    });

    test("rejects direct Worker monitors for private and metadata addresses", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors", {
                method: "POST",
                body: JSON.stringify({
                    name: "Metadata",
                    type: "http",
                    url: "http://169.254.169.254/latest/meta-data",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 400);
        assert.deepStrictEqual(await response.json(), {
            error: "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts",
        });
    });

    test("updates a monitor network route only to direct or an enabled profile", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [{ id: 42, network_profile_id: null }],
        });

        const twingateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: "twingate" }),
            }),
            env
        );
        assert.strictEqual(twingateResponse.status, 200);
        assert.deepStrictEqual(await twingateResponse.json(), { ok: true, networkProfileId: "twingate" });
        assert.strictEqual(env.state.monitors[0].network_profile_id, "twingate");

        const directResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: null }),
            }),
            env
        );
        assert.strictEqual(directResponse.status, 200);
        assert.deepStrictEqual(await directResponse.json(), { ok: true, networkProfileId: null });
        assert.strictEqual(env.state.monitors[0].network_profile_id, null);

        const invalidResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: "missing" }),
            }),
            env
        );
        assert.strictEqual(invalidResponse.status, 400);
    });

    test("check-now executes a sanitized monitor job and writes a heartbeat", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    hostname: null,
                    port: null,
                    timeout: 5,
                    network_profile_id: "twingate",
                },
            ],
            runnerResult: { status: 1, ping: 12, msg: "200 - OK", response: "ok" },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, { status: 1, ping: 12, msg: "200 - OK", response: "ok" });
        assert.strictEqual(env.state.runnerJobs.length, 1);
        assert.strictEqual(env.state.runnerJobs[0].networkProfile.slug, "twingate");
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 7,
            status: 1,
            ping: 12,
            msg: "200 - OK",
        });
    });
});

/**
 * Create a mock Worker environment for API handler tests.
 * @param {object} initial Initial mock state.
 * @returns {object} Mock Worker environment.
 */
function createEnv(initial) {
    const state = {
        profiles: initial.profiles || [],
        monitors: initial.monitors || [],
        heartbeats: initial.heartbeats || [],
        notifications: initial.notifications || [],
        monitorNotifications: initial.monitorNotifications || [],
        settings: initial.settings || {},
        runnerJobs: [],
        runnerResult: initial.runnerResult,
        runnerStatus: initial.runnerStatus || {
            configured: false,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: null,
            lastError: null,
        },
        nextMonitorId: initial.nextMonitorId || 1,
        nextNotificationId: initial.nextNotificationId || 1,
        missingConfigJsonColumn: Boolean(initial.missingConfigJsonColumn),
        missingParentColumn: Boolean(initial.missingParentColumn),
        missingNotificationTables: Boolean(initial.missingNotificationTables),
    };

    return {
        state,
        ADMIN_API_TOKEN: "adminToken" in initial ? initial.adminToken : "test-token",
        CF_ACCESS_TEAM_DOMAIN: initial.accessAuth?.teamDomain,
        CF_ACCESS_AUD: initial.accessAudience || initial.accessAuth?.audience,
        CF_ACCESS_CERTS_JSON: initial.accessAuth?.certsJson,
        DB: {
            prepare(sql) {
                return createStatement(sql, state);
            },
        },
        MONITOR_QUEUE: {
            sent: [],
            async send(message) {
                this.sent.push(message);
            },
        },
        RUNNER: {
            get() {
                return {
                    async fetch(request) {
                        const url = new URL(request.url);
                        if (request.method === "GET" && url.pathname === "/twingate/status") {
                            return Response.json(state.runnerStatus);
                        }
                        state.runnerJobs.push(await request.json());
                        return Response.json(state.runnerResult);
                    },
                };
            },
            idFromName(name) {
                return name;
            },
        },
    };
}

/**
 * Create an authenticated Worker API request for admin route tests.
 * @param {string} url Request URL.
 * @param {RequestInit} init Request init.
 * @returns {Request} Authenticated request.
 */
function adminRequest(url, init = {}) {
    return new Request(url, {
        ...init,
        headers: {
            ...(init.headers || {}),
            authorization: "Bearer test-token",
        },
    });
}

async function createAccessAuth(options = {}) {
    const teamDomain = "https://wgs.cloudflareaccess.com";
    const audience = options.audience || "test-access-aud";
    const keyPair = await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["sign", "verify"]
    );
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    publicJwk.kid = "test-kid";
    publicJwk.alg = "RS256";
    publicJwk.use = "sig";

    const header = base64UrlEncodeJson({ alg: "RS256", typ: "JWT", kid: publicJwk.kid });
    const payload = base64UrlEncodeJson({
        iss: teamDomain,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 300,
        sub: "user@example.com",
    });
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        keyPair.privateKey,
        new TextEncoder().encode(`${header}.${payload}`)
    );

    return {
        teamDomain,
        audience,
        certsJson: JSON.stringify({ keys: [publicJwk] }),
        token: `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`,
    };
}

function base64UrlEncodeJson(value) {
    return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncode(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Create a minimal D1 statement mock for API handler tests.
 * @param {string} sql SQL query text.
 * @param {object} state Mutable mock environment state.
 * @returns {object} D1 statement mock.
 */
function createStatement(sql, state) {
    const statement = {
        values: [],
        bind(...values) {
            this.values = values;
            return this;
        },
        async all() {
            if (sql.includes("PRAGMA table_info(monitors)")) {
                const columns = [
                    "id",
                    "name",
                    "type",
                    "url",
                    "hostname",
                    "port",
                    "method",
                    "headers",
                    "body",
                    "keyword",
                    "invert_keyword",
                    "json_path",
                    "expected_value",
                    "timeout",
                    "interval",
                    "active",
                    "network_profile_id",
                ];
                if (!state.missingParentColumn) {
                    columns.push("parent");
                }
                if (!state.missingConfigJsonColumn) {
                    columns.push("config_json");
                }
                return { results: columns.map((name, cid) => ({ cid, name })) };
            }
            if (state.missingConfigJsonColumn && /network_profile_id,\s*parent,\s*config_json/.test(sql)) {
                throw new Error("no such column: config_json");
            }
            if (state.missingParentColumn && /network_profile_id,\s*parent/.test(sql)) {
                throw new Error("no such column: parent");
            }
            if (sql.includes("FROM network_profiles")) {
                if (sql.includes("type = ?")) {
                    return { results: state.profiles.filter((profile) => profile.type === this.values[0] && profile.enabled) };
                }
                return { results: state.profiles };
            }
            if (sql.includes("FROM app_settings")) {
                return {
                    results: Object.entries(state.settings).map(([key, value]) => ({
                        key,
                        value: JSON.stringify(value),
                    })),
                };
            }
            if (sql.includes("FROM notification")) {
                if (state.missingNotificationTables) {
                    throw new Error("no such table: notification");
                }
                return { results: [...state.notifications] };
            }
            if (sql.includes("FROM monitors")) {
                if (sql.includes("WHERE id = ?")) {
                    return { results: state.monitors.filter((monitor) => monitor.id === Number(this.values[0])) };
                }
                return { results: [...state.monitors] };
            }
            if (sql.includes("FROM heartbeats")) {
                let results = [...state.heartbeats];
                if (sql.includes("WHERE monitor_id = ?")) {
                    results = results.filter((heartbeat) => heartbeat.monitor_id === Number(this.values[0]));
                }
                results.sort((a, b) => String(b.checked_at).localeCompare(String(a.checked_at)));
                if (sql.includes("LIMIT ?")) {
                    const limit = Number(this.values.at(-2));
                    const offset = Number(this.values.at(-1));
                    results = results.slice(offset, offset + limit);
                }
                return { results };
            }
            return { results: [] };
        },
        async first() {
            if (sql.includes("FROM monitors")) {
                const id = Number(this.values[0]);
                return state.monitors.find((monitor) => monitor.id === id) || null;
            }
            if (sql.includes("COUNT(*) AS count") && sql.includes("FROM heartbeats")) {
                const monitorId = Number(this.values[0]);
                return {
                    count: state.heartbeats.filter((heartbeat) => heartbeat.monitor_id === monitorId).length,
                };
            }
            if (sql.includes("FROM network_profiles")) {
                if (sql.includes("type = ?")) {
                    const type = this.values[0];
                    return state.profiles.find((profile) => profile.type === type && profile.enabled) || null;
                }
                const id = this.values[0];
                return state.profiles.find((profile) => profile.id === id && profile.enabled) || null;
            }
            if (sql.includes("FROM notification")) {
                if (state.missingNotificationTables) {
                    throw new Error("no such table: notification");
                }
                const id = Number(this.values[0]);
                return state.notifications.find((notification) => notification.id === id) || null;
            }
            return null;
        },
        async run() {
            if (sql.includes("ALTER TABLE monitors ADD COLUMN parent")) {
                state.missingParentColumn = false;
                for (const monitor of state.monitors) {
                    monitor.parent = monitor.parent ?? null;
                }
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_monitors_parent")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS notification")) {
                state.missingNotificationTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS monitor_notification")) {
                state.missingNotificationTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS monitor_notification_index")) {
                return { success: true };
            }
            if (sql.includes("INSERT INTO app_settings")) {
                const [key, value] = this.values;
                state.settings[key] = JSON.parse(value);
                return { success: true };
            }
            if (sql.includes("INSERT INTO notification")) {
                const [name, active, userId, isDefault, config] = this.values;
                const id = state.nextNotificationId++;
                state.notifications.push({
                    id,
                    name,
                    active,
                    user_id: userId,
                    is_default: isDefault,
                    config,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("UPDATE notification")) {
                const [name, active, userId, isDefault, config, id] = this.values;
                const notification = state.notifications.find((candidate) => candidate.id === Number(id));
                if (notification) {
                    Object.assign(notification, {
                        name,
                        active,
                        user_id: userId,
                        is_default: isDefault,
                        config,
                    });
                }
                return { success: true };
            }
            if (sql.includes("INSERT INTO monitor_notification")) {
                const [monitorId, notificationId] = this.values;
                const exists = state.monitorNotifications.some(
                    (row) => row.monitor_id === Number(monitorId) && row.notification_id === Number(notificationId)
                );
                if (!exists) {
                    state.monitorNotifications.push({
                        monitor_id: Number(monitorId),
                        notification_id: Number(notificationId),
                    });
                }
                return { success: true };
            }
            if (sql.includes("INSERT INTO monitors")) {
                const [
                    name,
                    type,
                    url,
                    hostname,
                    port,
                    method,
                    headers,
                    body,
                    keyword,
                    invertKeyword,
                    jsonPath,
                    expectedValue,
                    timeout,
                    interval,
                    active,
                    networkProfileId,
                    parent,
                    configJson,
                ] = this.values;
                const id = state.nextMonitorId++;
                state.monitors.push({
                    id,
                    name,
                    type,
                    url,
                    hostname,
                    port,
                    method,
                    headers,
                    body,
                    keyword,
                    invert_keyword: invertKeyword,
                    json_path: jsonPath,
                    expected_value: expectedValue,
                    timeout,
                    interval,
                    active,
                    network_profile_id: networkProfileId,
                    parent,
                    config_json: configJson,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("UPDATE monitors")) {
                if (sql.includes("SET parent = NULL")) {
                    const [parent] = this.values;
                    for (const monitor of state.monitors) {
                        if (monitor.parent === Number(parent)) {
                            monitor.parent = null;
                        }
                    }
                    return { success: true };
                }
                if (sql.includes("SET parent = ?")) {
                    const [parent, id] = this.values;
                    const monitor = state.monitors.find((candidate) => candidate.id === Number(id));
                    if (monitor) {
                        monitor.parent = parent == null ? null : Number(parent);
                    }
                    return { success: true };
                }
                if (sql.includes("SET network_profile_id")) {
                    const [networkProfileId, id] = this.values;
                    const monitor = state.monitors.find((candidate) => candidate.id === Number(id));
                    if (monitor) {
                        monitor.network_profile_id = networkProfileId;
                    }
                    return { success: true };
                }
                if (sql.includes("SET active")) {
                    const [active, id] = this.values;
                    const monitor = state.monitors.find((candidate) => candidate.id === Number(id));
                    if (monitor) {
                        monitor.active = active;
                    }
                    return { success: true };
                }
                const [
                    name,
                    type,
                    url,
                    hostname,
                    port,
                    method,
                    headers,
                    body,
                    keyword,
                    invertKeyword,
                    jsonPath,
                    expectedValue,
                    timeout,
                    interval,
                    networkProfileId,
                    parent,
                    configJson,
                    id,
                ] = this.values;
                const monitor = state.monitors.find((candidate) => candidate.id === Number(id));
                if (monitor) {
                    Object.assign(monitor, {
                        name,
                        type,
                        url,
                        hostname,
                        port,
                        method,
                        headers,
                        body,
                        keyword,
                        invert_keyword: invertKeyword,
                        json_path: jsonPath,
                        expected_value: expectedValue,
                        timeout,
                        interval,
                        network_profile_id: networkProfileId,
                        parent,
                        config_json: configJson,
                    });
                }
                return { success: true };
            }
            if (sql.includes("DELETE FROM monitors")) {
                const id = Number(this.values[0]);
                state.monitors = state.monitors.filter((monitor) => monitor.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM monitor_notification")) {
                const id = Number(this.values[0]);
                if (sql.includes("notification_id")) {
                    state.monitorNotifications = state.monitorNotifications.filter((row) => row.notification_id !== id);
                } else {
                    state.monitorNotifications = state.monitorNotifications.filter((row) => row.monitor_id !== id);
                }
                return { success: true };
            }
            if (sql.includes("DELETE FROM notification")) {
                const id = Number(this.values[0]);
                state.notifications = state.notifications.filter((notification) => notification.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM heartbeats")) {
                const monitorId = Number(this.values[0]);
                state.heartbeats = state.heartbeats.filter((heartbeat) => heartbeat.monitor_id !== monitorId);
                return { success: true };
            }
            if (sql.includes("INSERT INTO heartbeats")) {
                const [monitorId, status, ping, msg] = this.values;
                state.heartbeats.push({
                    monitor_id: Number(monitorId),
                    status,
                    ping,
                    msg,
                });
                return { success: true };
            }
            return { success: true };
        },
    };
    return statement;
}

/**
 * Copy selected keys from an object for concise assertions.
 * @param {object} source Source object.
 * @param {string[]} keys Keys to copy.
 * @returns {object} Object with selected keys.
 */
function pick(source, keys) {
    return Object.fromEntries(keys.map((key) => [key, source[key]]));
}
