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

        const response = await handleApiRequest(new Request("https://example.com/api/monitors"), env);
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

        const response = await handleApiRequest(new Request("https://example.com/api/monitors"), env);
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

        const getResponse = await handleApiRequest(new Request("https://example.com/api/settings"), env);
        const getBody = await getResponse.json();

        assert.strictEqual(getResponse.status, 200);
        assert.strictEqual(getBody.data.entryPage, "dashboard");
        assert.strictEqual(getBody.data.checkUpdate, true);
        assert.strictEqual(getBody.data.keepDataPeriodDays, 180);

        const putResponse = await handleApiRequest(
            new Request("https://example.com/api/settings", {
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

    test("creates, reads, updates, toggles, and deletes a supported monitor", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const createResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
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

        const readResponse = await handleApiRequest(new Request("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual(readBody.monitor.name, "Example HTTP");
        assert.strictEqual(readBody.monitor.interval, 90);

        const updateResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/1", {
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
            new Request("https://example.com/api/monitors/1/active", {
                method: "PATCH",
                body: JSON.stringify({ active: false }),
            }),
            env
        );
        assert.strictEqual(pauseResponse.status, 200);
        assert.deepStrictEqual(await pauseResponse.json(), { ok: true, active: false });
        assert.strictEqual(env.state.monitors[0].active, 0);

        const deleteResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/1", { method: "DELETE" }),
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
            new Request("https://example.com/api/monitors", {
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

        const readResponse = await handleApiRequest(new Request("https://example.com/api/monitors/1"), env);
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
            new Request("https://example.com/api/monitors/1", {
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

        const rereadResponse = await handleApiRequest(new Request("https://example.com/api/monitors/1"), env);
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
            new Request("https://example.com/api/monitors", {
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

        const readResponse = await handleApiRequest(new Request("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readBody.monitor.type, "ping");
        assert.strictEqual(readBody.monitor.hostname, "example.com");
        assert.strictEqual(readBody.monitor.ping_count, 3);
        assert.strictEqual(readBody.monitor.ping_per_request_timeout, 2);

        const checkResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/1/check-now", { method: "POST" }),
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
            new Request("https://example.com/api/monitors", {
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
            new Request("https://example.com/api/monitors/import", {
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
            new Request("https://example.com/api/monitors/import", {
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
            new Request("https://example.com/api/monitors/import", {
                method: "POST",
                body: JSON.stringify({
                    monitors: [
                        {
                            name: "Conference Computer",
                            type: "port",
                            url: "https://",
                            hostname: "192.168.10.137",
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

        const readResponse = await handleApiRequest(new Request("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();

        assert.deepStrictEqual(readBody.monitor.accepted_statuscodes, ["200-299"]);
        assert.strictEqual(readBody.monitor.ignoreTls, false);
        assert.strictEqual(readBody.monitor.upsideDown, true);
        assert.strictEqual(readBody.monitor.expiryNotification, false);
        assert.strictEqual(readBody.monitor.domainExpiryNotification, true);
        assert.strictEqual(readBody.monitor.cacheBust, false);
        assert.strictEqual(readBody.monitor.ping_numeric, true);
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

        const listResponse = await handleApiRequest(new Request("https://example.com/api/monitors/7/heartbeats"), env);
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
            new Request("https://example.com/api/monitors/7/heartbeats", { method: "DELETE" }),
            env
        );

        assert.strictEqual(clearResponse.status, 200);
        assert.deepStrictEqual(await clearResponse.json(), { ok: true, msg: "Heartbeats cleared" });
        assert.deepStrictEqual(env.state.heartbeats.map((heartbeat) => heartbeat.monitor_id), [8]);
    });

    test("lists direct and Twingate network profiles", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
        });

        const response = await handleApiRequest(new Request("https://example.com/api/network-profiles"), env);
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

        const response = await handleApiRequest(new Request("https://example.com/api/twingate/status"), env);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
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
            new Request("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: "twingate" }),
            }),
            env
        );
        assert.strictEqual(twingateResponse.status, 200);
        assert.deepStrictEqual(await twingateResponse.json(), { ok: true, networkProfileId: "twingate" });
        assert.strictEqual(env.state.monitors[0].network_profile_id, "twingate");

        const directResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/42/network-route", {
                method: "PATCH",
                body: JSON.stringify({ networkProfileId: null }),
            }),
            env
        );
        assert.strictEqual(directResponse.status, 200);
        assert.deepStrictEqual(await directResponse.json(), { ok: true, networkProfileId: null });
        assert.strictEqual(env.state.monitors[0].network_profile_id, null);

        const invalidResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors/42/network-route", {
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
            new Request("https://example.com/api/monitors/7/check-now", { method: "POST" }),
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
        settings: initial.settings || {},
        runnerJobs: [],
        runnerResult: initial.runnerResult,
        runnerStatus: initial.runnerStatus || {
            configured: false,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            lastError: null,
        },
        nextMonitorId: initial.nextMonitorId || 1,
        missingConfigJsonColumn: Boolean(initial.missingConfigJsonColumn),
    };

    return {
        state,
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
            if (state.missingConfigJsonColumn && sql.includes("config_json")) {
                throw new Error("no such column: config_json");
            }
            if (sql.includes("FROM network_profiles")) {
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
                const id = this.values[0];
                return state.profiles.find((profile) => profile.id === id && profile.enabled) || null;
            }
            return null;
        },
        async run() {
            if (sql.includes("INSERT INTO app_settings")) {
                const [key, value] = this.values;
                state.settings[key] = JSON.parse(value);
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
                    config_json: configJson,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("UPDATE monitors")) {
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
