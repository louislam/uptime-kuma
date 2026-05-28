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

    test("D1 migration adds latest-heartbeat lookup index", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0010_latest_heartbeat_lookup_index.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_checked_at_id/);
        assert.match(migrationSql, /heartbeats\(monitor_id, checked_at DESC, id DESC\)/);
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

    test("D1 migration creates tag settings tables", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0009_tags.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS tag/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitor_tag/);
        assert.match(migrationSql, /monitor_tag_monitor_id_index/);
        assert.match(migrationSql, /monitor_tag_tag_id_index/);
    });

    test("D1 migration creates Docker host settings table", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0009_docker_hosts.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS docker_host/);
        assert.match(migrationSql, /docker_daemon TEXT NOT NULL/);
        assert.match(migrationSql, /docker_type TEXT NOT NULL/);
    });

    test("D1 migration creates Remote Browser settings table", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0008_remote_browsers.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS remote_browser/);
        assert.match(migrationSql, /name TEXT NOT NULL/);
        assert.match(migrationSql, /url TEXT NOT NULL/);
    });

    test("Cloudflare D1 migrations keep unique numeric prefixes except the applied 0009 pair", async () => {
        const migrationsDir = path.join(__dirname, "../../../cloudflare/migrations");
        const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();
        const allowedDuplicatePrefixes = new Map([
            ["0009", ["0009_docker_hosts.sql", "0009_tags.sql"]],
        ]);
        const filesByPrefix = new Map();

        for (const file of files) {
            const prefix = file.match(/^(\d{4})_/)?.[1];
            assert.ok(prefix, `Cloudflare migration ${file} should start with a four-digit prefix`);
            filesByPrefix.set(prefix, [...(filesByPrefix.get(prefix) || []), file]);
        }

        for (const [prefix, prefixedFiles] of filesByPrefix) {
            if (prefixedFiles.length <= 1) {
                continue;
            }
            assert.deepStrictEqual(
                prefixedFiles,
                allowedDuplicatePrefixes.get(prefix),
                `Cloudflare migration prefix ${prefix} should not be reused for new migrations`
            );
        }
    });

    test("Worker deployment serves the Vue web UI as a single-page app", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.deepStrictEqual(wranglerConfig.assets, {
            directory: "./dist/",
            not_found_handling: "single-page-application",
            binding: "ASSETS",
            run_worker_first: ["/api/*"],
        });
        assert.strictEqual(wranglerConfig.keep_vars, true);
        assert.deepStrictEqual(wranglerConfig.version_metadata, {
            binding: "CF_VERSION_METADATA",
        });
        assert.strictEqual(wranglerConfig.vars.DEPLOY_MONITOR_PAUSE_SECONDS, "120");
        assert.match(workerSource, /return await env\.ASSETS\.fetch\(request\)/);
        assert.doesNotMatch(workerSource, /return await runner\.fetch\(request\)/);
    });

    test("Worker Twingate config does not expose a configurable proxy URL", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

        assert.ok(wranglerConfig.vars);
        assert.strictEqual(wranglerConfig.vars.APP_VERSION, "1.0.0");
        for (const name of [
            "TWINGATE_PROXY_URL",
            "TWINGATE_SERVICE_KEY_B64",
            "TWINGATE_SERVICE_KEY_JSON",
            "TWINGATE_NETWORK",
            "TWINGATE_SERVICE_ACCOUNT_ID",
            "TWINGATE_KEY_ID",
            "TWINGATE_PRIVATE_KEY",
            "TWINGATE_PRIVATE_KEY_B64",
            "TWINGATE_EXPIRES_AT",
        ]) {
            assert.strictEqual(name in wranglerConfig.vars, false, `${name} should not be committed in wrangler vars`);
        }
        assert.strictEqual(wranglerConfig.vars.TWINGATE_TUN, "off");
        assert.strictEqual(wranglerConfig.vars.TWINGATE_PING_FALLBACK_PORTS, "80,443");
    });

    test("Worker admin API keeps Cloudflare Access application identifiers out of checked-in vars", async () => {
        const wranglerPath = path.join(__dirname, "../../../wrangler.jsonc");
        const wranglerConfig = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

        assert.strictEqual("CF_ACCESS_TEAM_DOMAIN" in wranglerConfig.vars, false);
        assert.strictEqual("CF_ACCESS_AUD" in wranglerConfig.vars, false);
        assert.strictEqual("CF_ACCESS_CERTS_JSON" in wranglerConfig.vars, false);
    });

    test("runner container image installs runtime dependencies and includes Twingate lifecycle helper", async () => {
        const dockerfilePath = path.join(__dirname, "../../../cloudflare/runner/Dockerfile");
        const dockerfile = fs.readFileSync(dockerfilePath, "utf8");

        assert.match(dockerfile, /http-proxy-agent@7\.0\.2/);
        assert.match(dockerfile, /https-proxy-agent@7\.0\.6/);
        assert.match(dockerfile, /socks-proxy-agent@8\.0\.5/);
        assert.match(dockerfile, /COPY checker\.js server\.js twingate-lifecycle\.js twingate-service-key\.js \.\//);
    });

    test("runner container receives Twingate userspace defaults and readiness timeout env", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");
        const optionalEnvBlock = workerSource.slice(
            workerSource.indexOf("copyOptionalEnv(this.envVars, env, ["),
            workerSource.indexOf("]);", workerSource.indexOf("copyOptionalEnv(this.envVars, env, ["))
        );

        assert.match(workerSource, /APP_VERSION:\s*resolveAppVersion\(env\)/);
        assert.match(workerSource, /TWINGATE_READY_TIMEOUT_MS:\s*"60000"/);
        assert.match(workerSource, /TWINGATE_RESTART_DELAY_MS:\s*"1000"/);
        assert.match(workerSource, /TWINGATE_TUN:\s*"off"/);
        assert.match(workerSource, /TWINGATE_PING_FALLBACK_PORTS:\s*"80,443"/);
        assert.match(workerSource, /"TWINGATE_READY_TIMEOUT_MS"/);
        assert.match(workerSource, /"TWINGATE_RESTART_DELAY_MS"/);
        assert.match(workerSource, /"TWINGATE_PING_FALLBACK_PORTS"/);
        assert.doesNotMatch(optionalEnvBlock, /"TWINGATE_TUN"/);
        assert.match(workerSource, /JSON\.stringify\(value\)/);
    });

    test("Worker UI loads release version metadata from a health endpoint", async () => {
        const workerApiPath = path.join(__dirname, "../../../cloudflare/worker/api.mjs");
        const workerApiSource = fs.readFileSync(workerApiPath, "utf8");
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");

        assert.match(workerApiSource, /pathname === "\/api\/health"/);
        assert.match(workerApiSource, /version: resolveAppVersion\(env\)/);
        assert.match(socketMixinSource, /requestCloudflareJson\("\/api\/health"/);
        assert.match(socketMixinSource, /this\.info\.version = health\.version/);
    });

    test("runner container exposes health readiness and status failure hooks", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /this\.requiredPorts = \[8788\]/);
        assert.match(workerSource, /pingEndpoint = "localhost\/health"/);
        assert.match(workerSource, /onActivityExpired\(\)/);
        assert.match(workerSource, /hasTwingateServiceKeyInput\(this\.env\)/);
        assert.match(workerSource, /onStop\(\{/);
        assert.match(workerSource, /onError\(error\)/);
        assert.match(workerSource, /buildUnavailableTwingateStatus/);
    });

    test("runner Twingate status explicitly uses startup-aware container fetch retries", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /RUNNER_FETCH_MAX_RETRIES = 3/);
        assert.match(workerSource, /startRunnerContainer\(\)/);
        assert.match(workerSource, /portReadyTimeoutMS:\s*resolveTwingateStatusTimeoutMs\(this\.env\)/);
        assert.match(workerSource, /this\.containerFetch\(request,\s*RUNNER_PORT\)/);
        assert.match(workerSource, /persistStartingTwingateStatus/);
    });

    test("scheduled Worker checks Twingate health alerts", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /checkTwingateHealthAlert/);
        assert.match(workerSource, /await checkTwingateHealthAlert\(env\)/);
    });

    test("runner monitor checks use startup-aware forwarding instead of the default container fetch", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /return await this\.fetchRunnerRequest\(request\)/);
        assert.match(workerSource, /async fetchRunnerRequest\(request\)/);
        assert.match(workerSource, /Failed to start runner container/);
        assert.doesNotMatch(workerSource, /super\.fetch\(request\)/);
    });

    test("Twingate settings UI applies a browser-side status request timeout", async () => {
        const componentPath = path.join(__dirname, "../../../src/components/settings/Twingate.vue");
        const componentSource = fs.readFileSync(componentPath, "utf8");

        assert.match(componentSource, /const timeoutMs = resolveTwingateStatusBrowserTimeoutMs\(\)/);
        assert.match(componentSource, /AbortController/);
        assert.match(componentSource, /signal: controller\.signal/);
        assert.match(componentSource, /Twingate status request timed out/);
    });

    test("Worker UI enables Docker Hosts settings through the REST socket shim", async () => {
        const settingsPath = path.join(__dirname, "../../../src/pages/Settings.vue");
        const settingsSource = fs.readFileSync(settingsPath, "utf8");
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");

        assert.match(settingsSource, /"docker-hosts"/);
        assert.doesNotMatch(
            settingsSource,
            /return !\[[\s\S]*"monitor-history",\s*"twingate"/
        );
        assert.match(socketMixinSource, /requestCloudflareJson\("\/api\/docker-hosts"\)/);
        assert.match(socketMixinSource, /event === "addDockerHost"/);
        assert.match(socketMixinSource, /event === "deleteDockerHost"/);
        assert.match(socketMixinSource, /event === "testDockerHost"/);
    });

    test("Worker UI enables Remote Browsers settings through the REST socket shim", async () => {
        const settingsPath = path.join(__dirname, "../../../src/pages/Settings.vue");
        const settingsSource = fs.readFileSync(settingsPath, "utf8");
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");

        assert.match(settingsSource, /"remote-browsers"/);
        assert.match(socketMixinSource, /requestCloudflareJson\("\/api\/remote-browsers"\)/);
        assert.match(socketMixinSource, /event === "addRemoteBrowser"/);
        assert.match(socketMixinSource, /event === "deleteRemoteBrowser"/);
        assert.match(socketMixinSource, /event === "testRemoteBrowser"/);
    });

    test("Worker check-now UI shows runner and down-check failures as errors", async () => {
        const componentPath = path.join(__dirname, "../../../src/pages/Details.vue");
        const componentSource = fs.readFileSync(componentPath, "utf8");

        assert.match(componentSource, /body\.result\?\.skipped/);
        assert.match(componentSource, /Number\(body\.result\?\.status\) === 0/);
        assert.match(componentSource, /toastError\(body\.result\?\.msg \|\| "Runner check unavailable"\)/);
        assert.match(componentSource, /toastError\(body\.result\?\.msg \|\| "Check failed"\)/);
    });

    test("Worker UI API helper applies a request timeout for bootstrap calls", async () => {
        const apiHelperPath = path.join(__dirname, "../../../src/cloudflare-worker-api.js");
        const apiHelperSource = fs.readFileSync(apiHelperPath, "utf8");

        assert.match(apiHelperSource, /DEFAULT_WORKER_API_REQUEST_TIMEOUT_MS = 15000/);
        assert.match(apiHelperSource, /AbortController/);
        assert.match(apiHelperSource, /signal: controller\.signal/);
        assert.match(apiHelperSource, /Worker API request timed out/);
    });

    test("Worker UI hydrates monitors before slower heartbeat history requests", async () => {
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");
        const monitorApplyIndex = socketMixinSource.indexOf(
            "this.applyCloudflareWorkerDashboardState(buildCloudflareWorkerMonitorState(monitors, this.heartbeatList));"
        );
        const heartbeatRefreshIndex = socketMixinSource.indexOf(
            "void this.refreshCloudflareWorkerHeartbeatHistories(monitors);"
        );

        assert.match(socketMixinSource, /CLOUDFLARE_DASHBOARD_CACHE_KEY/);
        assert.match(socketMixinSource, /void this\.loadCloudflareWorkerInfo\(\);\s+await this\.refreshCloudflareWorkerAuthSession\(\);/);
        assert.match(socketMixinSource, /this\.applyCloudflareWorkerDashboardCache\(\);\s+await this\.loadCloudflareWorkerData\(\);/);
        assert.match(socketMixinSource, /Promise\.allSettled\(\[/);
        assert.match(socketMixinSource, /writeCloudflareWorkerDashboardCache/);
        assert.match(socketMixinSource, /refreshHeartbeatHistories = true/);
        assert.notStrictEqual(monitorApplyIndex, -1);
        assert.notStrictEqual(heartbeatRefreshIndex, -1);
        assert.ok(monitorApplyIndex < heartbeatRefreshIndex);
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

    test("auth session fails closed when Cloudflare Access cert lookup times out", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            adminToken: "",
            accessTeamDomain: "https://wgs.cloudflareaccess.com",
            accessAudience: "workers-dev-aud",
        });
        env.CF_ACCESS_CERT_LOOKUP_TIMEOUT_MS = "1000";
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => new Promise(() => {});
        try {
            const token = [
                base64UrlEncodeJson({ alg: "RS256", kid: "slow-key" }),
                base64UrlEncodeJson({
                    iss: "https://wgs.cloudflareaccess.com",
                    aud: "workers-dev-aud",
                    exp: Math.floor(Date.now() / 1000) + 60,
                }),
                "signature",
            ].join(".");
            const timedOut = Symbol("timed out");
            const result = await Promise.race([
                handleApiRequest(
                    new Request("https://example.com/api/auth/session", {
                        headers: {
                            "cf-access-jwt-assertion": token,
                        },
                    }),
                    env
                ),
                new Promise((resolve) => setTimeout(() => resolve(timedOut), 1500)),
            ]);

            assert.notStrictEqual(result, timedOut);
            assert.strictEqual(result.status, 200);
            assert.deepStrictEqual(await result.json(), {
                authenticated: false,
                username: null,
                localAuthConfigured: false,
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
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

    test("requires admin auth to save Worker status page setup", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            new Request("https://example.com/api/status-page/default", {
                method: "PUT",
                body: JSON.stringify({ publicGroupList: [] }),
            }),
            env
        );

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
    });

    test("saves Worker status page setup with group and individual monitor selections", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 1, name: "Sites", type: "group", active: 1, parent: null },
                { id: 2, name: "Private Site", type: "http", url: "https://private.example.test", active: 1, parent: 1 },
                { id: 3, name: "Hidden Site", type: "http", url: "https://hidden.example.test", active: 1, parent: 1 },
                { id: 4, name: "Public API", type: "http", url: "https://api.example.test", active: 1, parent: null },
            ],
        });

        const saveResponse = await handleApiRequest(
            adminRequest("https://example.com/api/status-page/default", {
                method: "PUT",
                body: JSON.stringify({
                    config: {
                        title: "Selected Services",
                        showPoweredBy: false,
                    },
                    publicGroupList: [
                        {
                            id: 10,
                            name: "Customer Services",
                            monitorList: [
                                { id: 1 },
                                { id: 4, sendUrl: true, url: "https://status-api.example.test" },
                            ],
                        },
                    ],
                }),
            }),
            env
        );
        const saveBody = await saveResponse.json();

        assert.strictEqual(saveResponse.status, 200);
        assert.strictEqual(saveBody.ok, true);
        assert.strictEqual(env.state.settings["statusPageConfig:default"].title, "Selected Services");
        assert.strictEqual(env.state.settings["statusPagePublicGroupList:default"][0].monitorList.length, 2);

        const publicResponse = await handleApiRequest(new Request("https://example.com/api/status-page/default"), env);
        const publicBody = await publicResponse.json();

        assert.strictEqual(publicResponse.status, 200);
        assert.strictEqual(publicBody.config.title, "Selected Services");
        assert.strictEqual(publicBody.config.showPoweredBy, false);
        assert.strictEqual(publicBody.publicGroupList.length, 1);
        assert.strictEqual(publicBody.publicGroupList[0].name, "Customer Services");
        assert.deepStrictEqual(
            publicBody.publicGroupList[0].monitorList.map((monitor) => monitor.id),
            [1, 4]
        );
        assert.strictEqual(publicBody.publicGroupList[0].monitorList[0].type, "group");
        assert.strictEqual(publicBody.publicGroupList[0].monitorList[1].url, "https://status-api.example.test");
        assert.strictEqual(publicBody.publicGroupList[0].monitorList[1].sendUrl, true);
    });

    test("saves and serves a custom Worker status page slug", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Customer Site",
                    type: "http",
                    url: "https://customer.example.test",
                    active: 1,
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 15,
                    msg: "200 - OK",
                    checked_at: "2026-05-20 12:00:00",
                },
            ],
        });

        const saveResponse = await handleApiRequest(
            adminRequest("https://example.com/api/status-page/default", {
                method: "PUT",
                body: JSON.stringify({
                    config: {
                        slug: "Page-Not-Found",
                        title: "Customer Status",
                    },
                    publicGroupList: [
                        {
                            id: 1,
                            name: "Customer Services",
                            monitorList: [{ id: 7 }],
                        },
                    ],
                }),
            }),
            env
        );
        const saveBody = await saveResponse.json();

        assert.strictEqual(saveResponse.status, 200);
        assert.strictEqual(saveBody.config.slug, "page-not-found");
        assert.strictEqual(env.state.settings["statusPageConfig:default"].slug, "page-not-found");

        const listResponse = await handleApiRequest(new Request("https://example.com/api/status-pages"), env);
        const listBody = await listResponse.json();
        assert.strictEqual(listBody.statusPages[1].slug, "page-not-found");

        const publicResponse = await handleApiRequest(
            new Request("https://example.com/api/status-page/page-not-found"),
            env
        );
        const publicBody = await publicResponse.json();

        assert.strictEqual(publicResponse.status, 200);
        assert.strictEqual(publicBody.config.slug, "page-not-found");
        assert.strictEqual(publicBody.config.title, "Customer Status");
        assert.strictEqual(publicBody.publicGroupList[0].monitorList[0].name, "Customer Site");

        const heartbeatResponse = await handleApiRequest(
            new Request("https://example.com/api/status-page/heartbeat/page-not-found"),
            env
        );
        const heartbeatBody = await heartbeatResponse.json();
        assert.strictEqual(heartbeatResponse.status, 200);
        assert.strictEqual(heartbeatBody.heartbeatList[7][0].msg, "200 - OK");

        const incidentHistoryResponse = await handleApiRequest(
            new Request("https://example.com/api/status-page/page-not-found/incident-history"),
            env
        );
        assert.strictEqual(incidentHistoryResponse.status, 200);
    });

    test("serves aggregate Worker heartbeat data for selected status page groups", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 1, name: "Sites", type: "group", active: 1, parent: null },
                { id: 2, name: "Private Site", type: "http", url: "https://private.example.test", active: 1, parent: 1 },
                { id: 3, name: "Hidden Site", type: "http", url: "https://hidden.example.test", active: 1, parent: 1 },
                { id: 4, name: "Public API", type: "http", url: "https://api.example.test", active: 1, parent: null },
            ],
            settings: {
                "statusPagePublicGroupList:default": [
                    {
                        id: 10,
                        name: "Customer Services",
                        monitorList: [
                            { id: 1 },
                            { id: 4 },
                        ],
                    },
                ],
            },
            heartbeats: [
                { monitor_id: 2, status: 1, ping: 10, msg: "OK", checked_at: "2026-05-11 02:30:00" },
                { monitor_id: 2, status: 1, ping: 11, msg: "OK", checked_at: "2026-05-11 02:31:00" },
                { monitor_id: 3, status: 1, ping: 20, msg: "OK", checked_at: "2026-05-11 02:30:00" },
                { monitor_id: 3, status: 0, ping: null, msg: "Down", checked_at: "2026-05-11 02:31:00" },
                { monitor_id: 4, status: 1, ping: 30, msg: "OK", checked_at: "2026-05-11 02:31:00" },
            ],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/status-page/heartbeat/default"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(Object.keys(body.heartbeatList).toSorted(), ["1", "4"]);
        assert.deepStrictEqual(
            body.heartbeatList[1].map((heartbeat) => heartbeat.status),
            [1, 0]
        );
        assert.strictEqual(body.uptimeList["1_24"], 0.75);
        assert.strictEqual(body.uptimeList["4_24"], 1);
        assert.strictEqual(body.heartbeatList[2], undefined);
        assert.strictEqual(body.heartbeatList[3], undefined);
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

    test("lists monitor latest heartbeats without a table-wide heartbeat aggregate", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    active: 1,
                },
                {
                    id: 8,
                    name: "Public HTTP",
                    type: "http",
                    url: "https://example.test",
                    active: 1,
                },
            ],
            heartbeats: [
                {
                    id: 101,
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "Timeout",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    id: 102,
                    monitor_id: 7,
                    status: 1,
                    ping: 18,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:31:00",
                },
                {
                    id: 103,
                    monitor_id: 8,
                    status: 1,
                    ping: 22,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.find((monitor) => monitor.id === 7).lastHeartbeat.msg, "200 - OK");
        assert.strictEqual(body.monitors.find((monitor) => monitor.id === 8).lastHeartbeat.ping, 22);
        assert.ok(
            env.state.queries.some((sql) => sql.includes("WITH requested_monitor_ids")),
            "monitor list should use the per-monitor latest heartbeat lookup"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("MAX(checked_at)") && !sql.includes("GROUP BY monitor_id")),
            "monitor list should not scan and aggregate all retained heartbeats"
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
        assert.strictEqual(getBody.data.twingateAlertEnabled, false);
        assert.deepStrictEqual(getBody.data.twingateAlertNotificationIDList, {});
        assert.strictEqual(getBody.data.twingateAlertThresholdMinutes, 5);

        const putResponse = await handleApiRequest(
            adminRequest("https://example.com/api/settings", {
                method: "PUT",
                body: JSON.stringify({
                    primaryBaseURL: "https://uptime.example.com",
                    checkUpdate: false,
                    searchEngineIndex: true,
                    twingateAlertEnabled: true,
                    twingateAlertNotificationIDList: {
                        3: true,
                    },
                    twingateAlertThresholdMinutes: 2,
                }),
            }),
            env
        );

        assert.strictEqual(putResponse.status, 200);
        assert.deepStrictEqual(await putResponse.json(), { ok: true, msg: "Settings saved" });
        assert.strictEqual(env.state.settings.primaryBaseURL, "https://uptime.example.com");
        assert.strictEqual(env.state.settings.checkUpdate, false);
        assert.strictEqual(env.state.settings.searchEngineIndex, true);
        assert.strictEqual(env.state.settings.twingateAlertEnabled, true);
        assert.deepStrictEqual(env.state.settings.twingateAlertNotificationIDList, { 3: true });
        assert.strictEqual(env.state.settings.twingateAlertThresholdMinutes, 2);
    });

    test("clears all Worker monitor statistics", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            heartbeats: [
                { monitor_id: 7, status: 1, ping: 12, msg: "200 - OK", checked_at: "2026-05-11 02:30:00" },
                { monitor_id: 8, status: 0, ping: 44, msg: "500 - Error", checked_at: "2026-05-11 02:00:00" },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/statistics", { method: "DELETE" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { ok: true, msg: "Statistics cleared" });
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("purges old Worker monitor history using the saved retention setting", async () => {
        const { purgeOldMonitorHistory } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                keepDataPeriodDays: 7,
            },
            heartbeats: [
                { monitor_id: 7, status: 1, ping: 12, msg: "fresh", checked_at: "2026-05-17 02:30:00" },
                { monitor_id: 8, status: 0, ping: 44, msg: "old", checked_at: "2026-05-01 02:00:00" },
            ],
        });

        const result = await purgeOldMonitorHistory(env, new Date("2026-05-18T12:00:00Z"));

        assert.deepStrictEqual(result, { deleted: true });
        assert.deepStrictEqual(env.state.heartbeats.map((heartbeat) => heartbeat.msg), ["fresh"]);
    });

    test("does not expose Worker auth settings through UI settings", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                workerAuthUser: {
                    username: "admin",
                    password: {
                        algorithm: "PBKDF2-SHA256",
                        iterations: 210000,
                        salt: "salt",
                        hash: "hash",
                    },
                },
                workerAuthSessionSecret: "secret",
            },
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/settings"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual("workerAuthUser" in body.data, false);
        assert.strictEqual("workerAuthSessionSecret" in body.data, false);
    });

    test("Cloudflare Access can bootstrap local Worker auth before a local account exists", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const accessAuth = await createAccessAuth();
        const env = createEnv({
            adminToken: "",
            accessAuth,
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/local-user", {
                method: "PUT",
                headers: {
                    "content-type": "application/json",
                    "cf-access-jwt-assertion": accessAuth.token,
                },
                body: JSON.stringify({
                    username: "admin",
                    newPassword: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        const body = await response.json();
        assert.match(body.token, /^[^.]+\.[^.]+\.[^.]+$/);
        delete body.token;
        assert.deepStrictEqual(body, {
            ok: true,
            msg: "Local admin login saved",
            username: "admin",
            localAuthConfigured: true,
        });
        assert.strictEqual(env.state.settings.workerAuthUser.username, "admin");
        assert.notStrictEqual(env.state.settings.workerAuthUser.password.hash, "password123");
        assert.strictEqual(env.state.settings.workerAuthUser.password.iterations, 100000);
    });

    test("Worker local password changes require the current password", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);

        const missingCurrentPasswordResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/local-user", {
                method: "PUT",
                body: JSON.stringify({
                    newPassword: "newpassword123",
                }),
            }),
            env
        );

        assert.strictEqual(missingCurrentPasswordResponse.status, 401);
        assert.deepStrictEqual(await missingCurrentPasswordResponse.json(), { error: "authIncorrectCreds" });

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/local-user", {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword: "password123",
                    newPassword: "newpassword123",
                }),
            }),
            env
        );

        assert.strictEqual(updateResponse.status, 200);
        const updateBody = await updateResponse.json();
        assert.strictEqual(updateBody.ok, true);
        assert.strictEqual(updateBody.username, "admin");

        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "newpassword123",
                }),
            }),
            env
        );

        assert.strictEqual(loginResponse.status, 200);
    });

    test("rejects unauthenticated Worker admin requests once local auth is configured", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);

        const response = await handleApiRequest(new Request("https://example.com/api/monitors"), env);

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
    });

    test("rejects Cloudflare Access for admin routes after local Worker auth is configured", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const accessAuth = await createAccessAuth();
        const env = createEnv({
            accessAuth,
        });
        await createLocalUser(handleApiRequest, env);

        const response = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    "cf-access-jwt-assertion": accessAuth.token,
                },
            }),
            env
        );

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "Unauthorized" });
    });

    test("Worker username and password login returns a session token for admin API access", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [],
        });
        await createLocalUser(handleApiRequest, env);

        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                    remember: true,
                }),
            }),
            env
        );
        const loginBody = await loginResponse.json();

        assert.strictEqual(loginResponse.status, 200);
        assert.strictEqual(loginBody.ok, true);
        assert.strictEqual(loginBody.username, "admin");
        assert.match(loginBody.token, /^[^.]+\.[^.]+\.[^.]+$/);

        const monitorsResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    authorization: `Bearer ${loginBody.token}`,
                },
            }),
            env
        );

        assert.strictEqual(monitorsResponse.status, 200);
        assert.deepStrictEqual(await monitorsResponse.json(), { monitors: [] });
    });

    test("Worker username and password login rejects incorrect credentials", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "wrong",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "authIncorrectCreds" });
    });

    test("Worker auth session endpoint returns the configured username", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);
        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                }),
            }),
            env
        );
        const { token } = await loginResponse.json();

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/session", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            authenticated: true,
            username: "admin",
            localAuthConfigured: true,
        });
    });

    test("Worker local password changes revoke existing session tokens", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [],
        });
        await createLocalUser(handleApiRequest, env);
        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                }),
            }),
            env
        );
        const { token: oldToken } = await loginResponse.json();

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/local-user", {
                method: "PUT",
                body: JSON.stringify({
                    currentPassword: "password123",
                    newPassword: "newpassword123",
                }),
            }),
            env
        );
        const { token: newToken } = await updateResponse.json();

        const oldTokenResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    authorization: `Bearer ${oldToken}`,
                },
            }),
            env
        );
        const newTokenResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    authorization: `Bearer ${newToken}`,
                },
            }),
            env
        );

        assert.strictEqual(oldTokenResponse.status, 401);
        assert.deepStrictEqual(await oldTokenResponse.json(), { error: "Unauthorized" });
        assert.strictEqual(newTokenResponse.status, 200);
    });

    test("Worker logout revokes the submitted local auth session token", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [],
        });
        await createLocalUser(handleApiRequest, env);
        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                }),
            }),
            env
        );
        const { token } = await loginResponse.json();

        const logoutResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/logout", {
                method: "POST",
                headers: {
                    authorization: `Bearer ${token}`,
                },
            }),
            env
        );
        const monitorsResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            }),
            env
        );

        assert.strictEqual(logoutResponse.status, 200);
        assert.deepStrictEqual(await logoutResponse.json(), { ok: true });
        assert.strictEqual(monitorsResponse.status, 401);
        assert.deepStrictEqual(await monitorsResponse.json(), { error: "Unauthorized" });
    });

    test("Worker 2FA setup verifies TOTP codes and requires them at login", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);

        const initialStatusResponse = await handleApiRequest(adminRequest("https://example.com/api/auth/2fa/status"), env);
        assert.strictEqual(initialStatusResponse.status, 200);
        assert.deepStrictEqual(await initialStatusResponse.json(), { ok: true, status: false });

        const prepareResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/2fa/prepare", {
                method: "POST",
                body: JSON.stringify({
                    currentPassword: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(prepareResponse.status, 200);
        const prepareBody = await prepareResponse.json();
        assert.strictEqual(prepareBody.ok, true);
        assert.match(prepareBody.uri, /^otpauth:\/\/totp\/Uptime%20Worker:admin\?secret=/);
        const token = await generateTotp(extractTotpSecret(prepareBody.uri));

        const verifyResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/2fa/verify", {
                method: "POST",
                body: JSON.stringify({
                    currentPassword: "password123",
                    token,
                }),
            }),
            env
        );

        assert.strictEqual(verifyResponse.status, 200);
        assert.deepStrictEqual(await verifyResponse.json(), { ok: true, valid: true });

        const saveResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/2fa/save", {
                method: "POST",
                body: JSON.stringify({
                    currentPassword: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(saveResponse.status, 200);
        assert.deepStrictEqual(await saveResponse.json(), { ok: true, msg: "2faEnabled", msgi18n: true });

        const passwordOnlyLoginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(passwordOnlyLoginResponse.status, 200);
        assert.deepStrictEqual(await passwordOnlyLoginResponse.json(), { tokenRequired: true });

        const tokenLoginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                    token,
                }),
            }),
            env
        );

        assert.strictEqual(tokenLoginResponse.status, 200);
        const tokenLoginBody = await tokenLoginResponse.json();
        assert.strictEqual(tokenLoginBody.ok, true);
        assert.strictEqual(tokenLoginBody.username, "admin");
        assert.match(tokenLoginBody.token, /^[^.]+\.[^.]+\.[^.]+$/);

        const replayResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "admin",
                    password: "password123",
                    token,
                }),
            }),
            env
        );

        assert.strictEqual(replayResponse.status, 200);
        assert.deepStrictEqual(await replayResponse.json(), {
            ok: false,
            msg: "authInvalidToken",
            msgi18n: true,
        });

        const disableResponse = await handleApiRequest(
            adminRequest("https://example.com/api/auth/2fa/disable", {
                method: "POST",
                body: JSON.stringify({
                    currentPassword: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(disableResponse.status, 200);
        assert.deepStrictEqual(await disableResponse.json(), { ok: true, msg: "2faDisabled", msgi18n: true });
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

    test("creates, attaches, updates, and deletes Worker tags", async () => {
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
            adminRequest("https://example.com/api/tags", {
                method: "POST",
                body: JSON.stringify({
                    name: "Team",
                    color: "#66bb6a",
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.strictEqual(createBody.tag.id, 1);
        assert.strictEqual(env.state.tags[0].name, "Team");

        const attachResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/tags", {
                method: "POST",
                body: JSON.stringify({
                    tagId: 1,
                    value: "api",
                }),
            }),
            env
        );

        assert.strictEqual(attachResponse.status, 200);
        assert.deepStrictEqual(env.state.monitorTags, [
            {
                id: 1,
                monitor_id: 7,
                tag_id: 1,
                value: "api",
            },
        ]);

        const monitorResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors"), env);
        const monitorBody = await monitorResponse.json();

        assert.strictEqual(monitorResponse.status, 200);
        assert.deepStrictEqual(monitorBody.monitors[0].tags, [
            {
                id: 1,
                monitor_id: 7,
                tag_id: 1,
                value: "api",
                name: "Team",
                color: "#66bb6a",
            },
        ]);

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/tags/1", {
                method: "PUT",
                body: JSON.stringify({
                    name: "Service",
                    color: "#42a5f5",
                }),
            }),
            env
        );

        assert.strictEqual(updateResponse.status, 200);
        assert.strictEqual(env.state.tags[0].name, "Service");

        const detachResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/tags", {
                method: "DELETE",
                body: JSON.stringify({
                    tagId: 1,
                    value: "api",
                }),
            }),
            env
        );

        assert.strictEqual(detachResponse.status, 200);
        assert.deepStrictEqual(env.state.monitorTags, []);

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/tags/1", { method: "DELETE" }),
            env
        );

        assert.strictEqual(deleteResponse.status, 200);
        assert.deepStrictEqual(env.state.tags, []);
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

    test("sends Pushover test notifications from the Worker API", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ status: 1 });
        };

        try {
            const response = await handleApiRequest(
                adminRequest("https://example.com/api/notifications/test", {
                    method: "POST",
                    body: JSON.stringify({
                        type: "pushover",
                        name: "Pushover Alerts",
                        pushoveruserkey: "user-key",
                        pushoverapptoken: "app-token",
                        pushoversounds: "pushover",
                        pushoverpriority: "-1",
                        pushovertitle: "Worker Alert",
                        pushoverdevice: "phone",
                        pushoverttl: "120",
                    }),
                }),
                env
            );
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.deepStrictEqual(body, { ok: true, msg: "Sent Successfully." });
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://api.pushover.net/1/messages.json");
            assert.strictEqual(sentRequests[0].init.method, "POST");
            assert.strictEqual(sentRequests[0].init.headers["content-type"], "application/x-www-form-urlencoded");
            assert.strictEqual(sentRequests[0].init.body.get("token"), "app-token");
            assert.strictEqual(sentRequests[0].init.body.get("user"), "user-key");
            assert.strictEqual(sentRequests[0].init.body.get("message"), "Pushover Alerts Testing");
            assert.strictEqual(sentRequests[0].init.body.get("title"), "Worker Alert");
            assert.strictEqual(sentRequests[0].init.body.get("device"), "phone");
            assert.strictEqual(sentRequests[0].init.body.get("ttl"), "120");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("sends Microsoft Teams test notifications from the Worker API", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ ok: true });
        };

        try {
            const response = await handleApiRequest(
                adminRequest("https://example.com/api/notifications/test", {
                    method: "POST",
                    body: JSON.stringify({
                        type: "teams",
                        name: "Teams Alerts",
                        webhookUrl: "https://example.webhook.office.com/services/example",
                    }),
                }),
                env
            );
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.deepStrictEqual(body, { ok: true, msg: "Sent Successfully." });
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://example.webhook.office.com/services/example");
            assert.strictEqual(sentRequests[0].init.method, "POST");
            assert.strictEqual(sentRequests[0].init.headers["content-type"], "application/json");

            const payload = JSON.parse(sentRequests[0].init.body);
            assert.strictEqual(payload.type, "message");
            assert.strictEqual(payload.summary, "Teams Alerts Testing");
            assert.strictEqual(payload.attachments[0].contentType, "application/vnd.microsoft.card.adaptive");
            assert.strictEqual(payload.attachments[0].content.body[1].facts[0].value, "Teams Alerts Testing");
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("rejects Microsoft Teams test notifications without an HTTPS webhook URL", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/notifications/test", {
                method: "POST",
                body: JSON.stringify({
                    type: "teams",
                    name: "Teams Alerts",
                    webhookUrl: "http://example.com/webhook",
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 400);
        assert.deepStrictEqual(body, { error: "Teams webhook URL must be a valid HTTPS URL" });
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
        assert.strictEqual(createBody.monitor.id, 1);
        assert.strictEqual(createBody.monitor.name, "Example HTTP");
        assert.strictEqual(createBody.monitor.interval, 90);

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/1"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual(readBody.monitor.name, "Example HTTP");
        assert.strictEqual(readBody.monitor.interval, 90);

        const updateQueryStart = env.state.queries.length;
        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/1", {
                method: "PUT",
                body: JSON.stringify({
                    ...readBody.monitor,
                    notificationIDList: undefined,
                    name: "Renamed HTTP",
                    method: "POST",
                    body: "{\"ok\":true}",
                }),
            }),
            env
        );

        assert.strictEqual(updateResponse.status, 200);
        const updateBody = await updateResponse.json();
        assert.strictEqual(updateBody.ok, true);
        assert.strictEqual(updateBody.msg, "Monitor saved");
        assert.strictEqual(
            Object.prototype.hasOwnProperty.call(updateBody, "monitor"),
            false,
            "Worker monitor updates should acknowledge the save without waiting on full monitor serialization"
        );
        assert.doesNotMatch(
            env.state.queries.slice(updateQueryStart).join("\n"),
            /FROM heartbeats/,
            "Worker monitor updates should not re-read heartbeat history before responding"
        );
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
        const pauseBody = await pauseResponse.json();
        assert.strictEqual(pauseBody.ok, true);
        assert.strictEqual(pauseBody.active, false);
        assert.strictEqual(pauseBody.monitor.id, 1);
        assert.strictEqual(pauseBody.monitor.active, false);
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

    test("round-trips Worker monitor notification selections", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Sales OS",
                    type: "http",
                    url: "https://sales.wgsglobal.app",
                    active: 1,
                    timeout: 30,
                    interval: 60,
                    network_profile_id: null,
                },
            ],
            notifications: [
                {
                    id: 2,
                    name: "Pushover Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 1,
                    config: JSON.stringify({ type: "pushover" }),
                },
                {
                    id: 3,
                    name: "Pushover Urgent",
                    active: 1,
                    user_id: 1,
                    is_default: 0,
                    config: JSON.stringify({ type: "pushover" }),
                },
            ],
            monitorNotifications: [{ monitor_id: 7, notification_id: 2 }],
        });

        const readResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/7"), env);
        const readBody = await readResponse.json();
        assert.strictEqual(readResponse.status, 200);
        assert.deepStrictEqual(readBody.monitor.notificationIDList, { 2: true });

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7", {
                method: "PUT",
                body: JSON.stringify({
                    ...readBody.monitor,
                    notificationIDList: {
                        2: false,
                        3: true,
                    },
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.deepStrictEqual(env.state.monitorNotifications, [{ monitor_id: 7, notification_id: 3 }]);

        const rereadResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/7"), env);
        const rereadBody = await rereadResponse.json();
        assert.strictEqual(rereadResponse.status, 200);
        assert.deepStrictEqual(rereadBody.monitor.notificationIDList, { 3: true });
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
            saveResponse: false,
            saveErrorResponse: true,
            responseMaxLength: 1024,
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

    test("routes imported private hostname monitors through Twingate by default", async () => {
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
                            name: "Ring HA",
                            type: "ping",
                            hostname: "ring-ha.wgs",
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
        assert.strictEqual(body.failed, 0);
        assert.strictEqual(env.state.monitors[0].network_profile_id, "twingate");
    });

    test("check-now routes private Ping hostnames through Twingate before running", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 211,
                    name: "Ring HA",
                    type: "ping",
                    url: null,
                    hostname: "ring-ha.wgs",
                    port: null,
                    timeout: 5,
                    network_profile_id: null,
                },
            ],
            runnerResult: { status: 1, ping: 1.8, msg: "1.8 ms", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/211/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, { status: 1, ping: 1.8, msg: "1.8 ms", response: null });
        assert.strictEqual(env.state.runnerJobs.length, 1);
        assert.strictEqual(env.state.runnerJobs[0].networkProfile.slug, "twingate");
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 211,
            status: 1,
            ping: 1.8,
            msg: "1.8 ms",
        });
    });

    test("check-now retries direct Ping private-target failures through Twingate", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 212,
                    name: "Private DNS",
                    type: "ping",
                    url: null,
                    hostname: "private.example.test",
                    port: null,
                    timeout: 5,
                    network_profile_id: null,
                },
            ],
            runnerResults: [
                {
                    status: 0,
                    ping: 1,
                    msg: "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts",
                    response: null,
                },
                { status: 1, ping: 2.4, msg: "2.4 ms", response: null },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/212/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, { status: 1, ping: 2.4, msg: "2.4 ms", response: null });
        assert.strictEqual(env.state.runnerJobs.length, 2);
        assert.strictEqual(env.state.runnerJobs[0].networkProfile, null);
        assert.strictEqual(env.state.runnerJobs[1].networkProfile.slug, "twingate");
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 212,
            status: 1,
            ping: 2.4,
            msg: "2.4 ms",
        });
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

    test("lists only important Worker monitor heartbeats for event logs", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [{ id: 7, name: "Private HTTP", type: "http", active: 1 }],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "initial up",
                    checked_at: "2026-05-11 02:00:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 11,
                    msg: "routine up",
                    checked_at: "2026-05-11 02:01:00",
                },
                {
                    monitor_id: 7,
                    status: 2,
                    ping: null,
                    msg: "retry pending",
                    checked_at: "2026-05-11 02:02:00",
                },
                {
                    monitor_id: 7,
                    status: 2,
                    ping: null,
                    msg: "still pending",
                    checked_at: "2026-05-11 02:03:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 10,
                    msg: "recovered from pending",
                    checked_at: "2026-05-11 02:04:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 9,
                    msg: "routine up after recovery",
                    checked_at: "2026-05-11 02:05:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "down",
                    checked_at: "2026-05-11 02:06:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "still down",
                    checked_at: "2026-05-11 02:07:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 8,
                    msg: "recovered from down",
                    checked_at: "2026-05-11 02:08:00",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/heartbeats?important=1&offset=0&count=20"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.count, 6);
        assert.deepStrictEqual(
            body.heartbeats.map((heartbeat) => heartbeat.msg),
            [
                "recovered from down",
                "still down",
                "down",
                "recovered from pending",
                "still pending",
                "retry pending",
            ]
        );
    });

    test("lists aggregate important Worker heartbeats for dashboard event logs", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
                { id: 8, name: "VPN Edge", type: "ping", active: 1 },
                { id: 9, name: "Paused LTE", type: "ping", active: 0 },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "primary up",
                    checked_at: "2026-05-12 04:00:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "primary older down",
                    checked_at: "2026-05-12 04:15:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 10,
                    msg: "primary older recovered",
                    checked_at: "2026-05-12 04:16:00",
                },
                {
                    monitor_id: 8,
                    status: 1,
                    ping: 8,
                    msg: "vpn up",
                    checked_at: "2026-05-22 08:00:00",
                },
                {
                    monitor_id: 8,
                    status: 2,
                    ping: null,
                    msg: "vpn newer pending",
                    checked_at: "2026-05-22 08:10:00",
                },
                {
                    monitor_id: 8,
                    status: 1,
                    ping: 7,
                    msg: "vpn newer recovered",
                    checked_at: "2026-05-22 08:11:00",
                },
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "primary newest down",
                    checked_at: "2026-05-23 10:00:00",
                },
                {
                    monitor_id: 9,
                    status: 0,
                    ping: null,
                    msg: "paused newest down",
                    checked_at: "2026-05-23 11:00:00",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/heartbeats?important=1&offset=0&count=3"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.count, 5);
        assert.deepStrictEqual(
            body.heartbeats.map((heartbeat) => heartbeat.msg),
            [
                "primary newest down",
                "vpn newer recovered",
                "vpn newer pending",
            ]
        );
    });

    test("lists aggregate important Worker heartbeats without returning all retained heartbeats to the Worker", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
                { id: 8, name: "VPN Edge", type: "ping", active: 1 },
            ],
            heartbeats: [
                { id: 101, monitor_id: 7, status: 1, ping: 12, msg: "primary up", checked_at: "2026-05-12 04:00:00" },
                { id: 102, monitor_id: 7, status: 1, ping: 11, msg: "primary routine up", checked_at: "2026-05-12 04:01:00" },
                { id: 103, monitor_id: 7, status: 0, ping: null, msg: "primary down", checked_at: "2026-05-12 04:02:00" },
                { id: 104, monitor_id: 7, status: 1, ping: 10, msg: "primary recovered", checked_at: "2026-05-12 04:03:00" },
                { id: 201, monitor_id: 8, status: 1, ping: 9, msg: "vpn up", checked_at: "2026-05-12 04:00:00" },
                { id: 202, monitor_id: 8, status: 2, ping: null, msg: "vpn pending", checked_at: "2026-05-12 04:04:00" },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/heartbeats?important=1&offset=0&count=2"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.count, 3);
        assert.deepStrictEqual(
            body.heartbeats.map((heartbeat) => heartbeat.msg),
            [
                "vpn pending",
                "primary recovered",
            ]
        );

        const aggregateHeartbeatQueries = env.state.queries.filter(
            (sql) => sql.includes("FROM heartbeats") && sql.includes("important_events")
        );
        assert.ok(
            aggregateHeartbeatQueries.some((sql) => sql.includes("LAG(status) OVER")),
            "aggregate event log should classify transitions in D1 instead of in Worker JavaScript"
        );
        assert.ok(
            aggregateHeartbeatQueries.some((sql) => sql.includes("COUNT(*) AS total_count FROM important_events")),
            "aggregate event log should return the total count with the requested page"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("ORDER BY monitor_id ASC, checked_at ASC, id ASC")),
            "aggregate event log should not fetch every retained active heartbeat before pagination"
        );
    });

    test("does not list important event-log heartbeats for paused Worker monitors", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [{ id: 7, name: "Archived Ping", type: "ping", active: 0 }],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "down while archived",
                    checked_at: "2026-05-11 02:06:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 8,
                    msg: "recovered while archived",
                    checked_at: "2026-05-11 02:08:00",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/heartbeats?important=1&offset=0&count=20"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.count, 0);
        assert.deepStrictEqual(body.heartbeats, []);
    });

    test("Worker dashboard event aggregation uses the aggregate Worker heartbeat API", () => {
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");

        assert.match(socketMixinSource, /monitorID == null \? "\/api\/heartbeats"/);
        assert.match(socketMixinSource, /requestCloudflareJson\(buildCloudflareHeartbeatsUrl\(monitorID, 0, 1, \{\s*importantOnly: true,/);
        assert.doesNotMatch(socketMixinSource, /return getCloudflareImportantHeartbeatRows\(app\)\.length/);
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

    test("creates, updates, lists, tests, and deletes Worker Docker hosts", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/docker-hosts", {
                method: "POST",
                body: JSON.stringify({
                    name: "Runner Docker",
                    dockerType: "socket",
                    dockerDaemon: "/var/run/docker.sock",
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.deepStrictEqual(createBody, { ok: true, msg: "Saved.", msgi18n: true, id: 1 });

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/docker-hosts/1", {
                method: "PUT",
                body: JSON.stringify({
                    name: "Remote Docker",
                    dockerType: "tcp",
                    dockerDaemon: "https://docker.example.test:2376",
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.deepStrictEqual(await updateResponse.json(), { ok: true, msg: "Saved.", msgi18n: true, id: 1 });

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/docker-hosts"), env);
        assert.strictEqual(listResponse.status, 200);
        assert.deepStrictEqual(await listResponse.json(), {
            dockerHosts: [
                {
                    id: 1,
                    user_id: 1,
                    name: "Remote Docker",
                    dockerDaemon: "https://docker.example.test:2376",
                    dockerType: "tcp",
                },
            ],
        });

        const testResponse = await handleApiRequest(
            adminRequest("https://example.com/api/docker-hosts/test", {
                method: "POST",
                body: JSON.stringify({
                    name: "Remote Docker",
                    dockerType: "tcp",
                    dockerDaemon: "https://docker.example.test:2376",
                }),
            }),
            env
        );
        assert.strictEqual(testResponse.status, 200);
        assert.deepStrictEqual(await testResponse.json(), {
            ok: false,
            msg: "Docker host testing is not available in the Cloudflare Worker UI yet.",
        });

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/docker-hosts/1", { method: "DELETE" }),
            env
        );
        assert.strictEqual(deleteResponse.status, 200);
        assert.deepStrictEqual(await deleteResponse.json(), { ok: true, msg: "successDeleted", msgi18n: true });
        assert.deepStrictEqual(env.state.dockerHosts, []);
    });

    test("creates, updates, lists, tests, and deletes Worker Remote Browsers", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/remote-browsers", {
                method: "POST",
                body: JSON.stringify({
                    name: "Browserless",
                    url: "wss://chrome.browserless.io/playwright?token=test-token",
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.deepStrictEqual(createBody, { ok: true, msg: "Saved.", msgi18n: true, id: 1 });

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/remote-browsers/1", {
                method: "PUT",
                body: JSON.stringify({
                    name: "Private Browser",
                    url: "ws://browser.internal:3000/playwright",
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.deepStrictEqual(await updateResponse.json(), { ok: true, msg: "Saved.", msgi18n: true, id: 1 });

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/remote-browsers"), env);
        assert.strictEqual(listResponse.status, 200);
        assert.deepStrictEqual(await listResponse.json(), {
            remoteBrowsers: [
                {
                    id: 1,
                    user_id: 1,
                    name: "Private Browser",
                    url: "ws://browser.internal:3000/playwright",
                },
            ],
        });

        const testResponse = await handleApiRequest(
            adminRequest("https://example.com/api/remote-browsers/test", {
                method: "POST",
                body: JSON.stringify({
                    name: "Private Browser",
                    url: "ws://browser.internal:3000/playwright",
                }),
            }),
            env
        );
        assert.strictEqual(testResponse.status, 200);
        assert.deepStrictEqual(await testResponse.json(), {
            ok: false,
            msg: "Remote browser connection testing is not available in the Cloudflare Worker UI yet.",
        });

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/remote-browsers/1", { method: "DELETE" }),
            env
        );
        assert.strictEqual(deleteResponse.status, 200);
        assert.deepStrictEqual(await deleteResponse.json(), { ok: true, msg: "successDeleted", msgi18n: true });
        assert.deepStrictEqual(env.state.remoteBrowsers, []);
    });

    test("creates, updates, lists, and deletes Worker proxies", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [{ id: 11, name: "API", proxy_id: null }],
        });

        const createResponse = await handleApiRequest(
            adminRequest("https://example.com/api/proxies", {
                method: "POST",
                body: JSON.stringify({
                    protocol: "http",
                    host: "proxy.example.test",
                    port: 8080,
                    auth: true,
                    username: "user",
                    password: "pass",
                    active: true,
                    default: true,
                    applyExisting: true,
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.deepStrictEqual(createBody, { ok: true, msg: "Saved.", msgi18n: true, id: 1 });
        assert.strictEqual(env.state.monitors[0].proxy_id, 1);

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/proxies/1", {
                method: "PUT",
                body: JSON.stringify({
                    protocol: "https",
                    host: "secure-proxy.example.test",
                    port: 8443,
                    auth: false,
                    active: false,
                    default: false,
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.deepStrictEqual(await updateResponse.json(), { ok: true, msg: "Saved.", msgi18n: true, id: 1 });

        const listResponse = await handleApiRequest(adminRequest("https://example.com/api/proxies"), env);
        assert.strictEqual(listResponse.status, 200);
        assert.deepStrictEqual(await listResponse.json(), {
            proxies: [
                {
                    id: 1,
                    user_id: 1,
                    protocol: "https",
                    host: "secure-proxy.example.test",
                    port: 8443,
                    auth: false,
                    username: null,
                    password: null,
                    active: false,
                    default: false,
                },
            ],
        });

        const deleteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/proxies/1", { method: "DELETE" }),
            env
        );
        assert.strictEqual(deleteResponse.status, 200);
        assert.deepStrictEqual(await deleteResponse.json(), { ok: true, msg: "successDeleted", msgi18n: true });
        assert.deepStrictEqual(env.state.proxies, []);
        assert.strictEqual(env.state.monitors[0].proxy_id, null);
    });

    test("keeps only one default Worker proxy", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            proxies: [
                {
                    id: 1,
                    user_id: 1,
                    protocol: "http",
                    host: "old-default.example.test",
                    port: 8080,
                    auth: 0,
                    username: null,
                    password: null,
                    active: 1,
                    default: 1,
                },
            ],
            nextProxyId: 2,
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/proxies", {
                method: "POST",
                body: JSON.stringify({
                    protocol: "http",
                    host: "new-default.example.test",
                    port: 8081,
                    active: true,
                    default: true,
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(env.state.proxies.map((proxy) => [proxy.id, proxy.default]), [
            [1, 0],
            [2, 1],
        ]);
    });

    test("serializes monitor proxy assignment and sends active proxy to runner", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Public HTTP",
                    type: "http",
                    url: "https://example.test/health",
                    hostname: null,
                    port: null,
                    timeout: 5,
                    network_profile_id: null,
                    proxy_id: 3,
                },
            ],
            proxies: [
                {
                    id: 3,
                    user_id: 1,
                    protocol: "http",
                    host: "proxy.example.test",
                    port: 8080,
                    auth: 1,
                    username: "user",
                    password: "pass",
                    active: 1,
                    default: 0,
                },
            ],
            runnerResult: { status: 1, ping: 12, msg: "200 - OK", response: "ok" },
        });

        const monitorResponse = await handleApiRequest(adminRequest("https://example.com/api/monitors/7"), env);
        const monitorBody = await monitorResponse.json();
        assert.strictEqual(monitorResponse.status, 200);
        assert.strictEqual(monitorBody.monitor.proxyId, 3);

        const checkResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        assert.strictEqual(checkResponse.status, 200);
        assert.deepStrictEqual(env.state.runnerJobs[0].monitor.proxy, {
            id: 3,
            protocol: "http",
            host: "proxy.example.test",
            port: 8080,
            auth: true,
            username: "user",
            password: "pass",
            active: true,
        });

        const updateResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7", {
                method: "PUT",
                body: JSON.stringify({
                    name: "Public HTTP",
                    type: "http",
                    url: "https://example.test/health",
                    timeout: 5,
                    proxyId: null,
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.strictEqual(env.state.monitors[0].proxy_id, null);
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

    test("returns sanitized Twingate status when runner status request fails", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerStatusResponseStatus: 500,
            runnerStatus: {
                error: "container crashed before status endpoint",
            },
        });
        env.TWINGATE_PRIVATE_KEY_B64 = "configured-secret";
        env.TWINGATE_TUN = "on";

        const response = await handleApiRequest(adminRequest("https://example.com/api/twingate/status"), env);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            configured: true,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "Runner status failed with 500: container crashed before status endpoint",
        });
    });

    test("returns sanitized Twingate status for Cloudflare container startup failure", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerStatusResponseStatus: 500,
            runnerStatus: "Failed to start container: The container is not running, consider calling start()",
        });
        env.TWINGATE_PRIVATE_KEY_B64 = "configured-secret";
        env.TWINGATE_TUN = "on";

        const response = await handleApiRequest(adminRequest("https://example.com/api/twingate/status"), env);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "Twingate runner container is starting or provisioning. Refresh in a few seconds.",
        });
    });

    test("returns starting Twingate status for aborted Cloudflare container startup", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerStatusResponseStatus: 500,
            runnerStatus: "Failed to start runner container: Failed to start container: The operation was aborted",
        });
        env.TWINGATE_PRIVATE_KEY_B64 = "configured-secret";
        env.TWINGATE_TUN = "on";

        const response = await handleApiRequest(adminRequest("https://example.com/api/twingate/status"), env);

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "Twingate runner container is starting or provisioning. Refresh in a few seconds.",
        });
    });

    test("returns sanitized Twingate status when runner status request times out", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            runnerStatusNeverResolves: true,
        });
        env.TWINGATE_PRIVATE_KEY_B64 = "configured-secret";
        env.TWINGATE_TUN = "on";
        env.TWINGATE_STATUS_REQUEST_TIMEOUT_MS = "1000";

        const timedOut = Symbol("timed out");
        const result = await Promise.race([
            handleApiRequest(adminRequest("https://example.com/api/twingate/status"), env),
            new Promise((resolve) => setTimeout(() => resolve(timedOut), 1500)),
        ]);

        assert.notStrictEqual(result, timedOut);
        assert.strictEqual(result.status, 200);
        assert.deepStrictEqual(await result.json(), {
            configured: true,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "Runner status timed out after 1000ms",
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

    test("check-now on a group runs all active child monitor checks", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 70, name: "Endpoints", type: "group", active: 1, parent: null },
                {
                    id: 71,
                    name: "API",
                    type: "http",
                    url: "https://api.example.test",
                    active: 1,
                    parent: 70,
                    network_profile_id: null,
                },
                {
                    id: 72,
                    name: "Nested",
                    type: "group",
                    active: 1,
                    parent: 70,
                },
                {
                    id: 73,
                    name: "Ping",
                    type: "ping",
                    hostname: "192.0.2.73",
                    active: 1,
                    parent: 72,
                    network_profile_id: null,
                },
                {
                    id: 74,
                    name: "Paused",
                    type: "http",
                    url: "https://paused.example.test",
                    active: 0,
                    parent: 70,
                    network_profile_id: null,
                },
            ],
            runnerResults: [
                { status: 1, ping: 12, msg: "200 - OK", response: null },
                { status: 1, ping: 18, msg: "pong", response: null },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/70/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.result.checked, 2);
        assert.strictEqual(body.result.status, 1);
        assert.strictEqual(body.result.msg, "Checked 2 monitors");
        assert.deepStrictEqual(
            env.state.runnerJobs.map((job) => job.monitor.id),
            [71, 73]
        );
        assert.deepStrictEqual(
            env.state.heartbeats.map((heartbeat) => heartbeat.monitor_id),
            [71, 73]
        );
    });

    test("check-now records failed checks as pending until monitor retries are exhausted", async () => {
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
                    timeout: 5,
                    network_profile_id: null,
                    config_json: JSON.stringify({ maxretries: 2 }),
                },
            ],
            runnerResult: { status: 0, ping: 120, msg: "Request timed out", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.result.status, 2);
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 7,
            status: 2,
            ping: 120,
            msg: "Request timed out",
        });
    });

    test("check-now records Twingate service outages as pending", async () => {
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
                    config_json: JSON.stringify({ maxretries: 0 }),
                },
            ],
            runnerResult: {
                status: 0,
                ping: 0,
                msg: "Twingate proxy is not ready",
                response: null,
            },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.result.status, 2);
        assert.strictEqual(body.result.msg, "Twingate service isn't running");
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 7,
            status: 2,
            ping: 0,
            msg: "Twingate service isn't running",
        });
    });

    test("check-now records down after configured pending retries are exhausted", async () => {
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
                    timeout: 5,
                    network_profile_id: null,
                    config_json: JSON.stringify({ maxretries: 2 }),
                },
            ],
            heartbeats: [
                {
                    monitor_id: 7,
                    status: 2,
                    ping: 120,
                    msg: "Request timed out",
                    checked_at: "2026-05-18 14:02:00",
                },
                {
                    monitor_id: 7,
                    status: 2,
                    ping: 110,
                    msg: "Request timed out",
                    checked_at: "2026-05-18 14:01:00",
                },
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 20,
                    msg: "200 - OK",
                    checked_at: "2026-05-18 14:00:00",
                },
            ],
            runnerResult: { status: 0, ping: 130, msg: "Request timed out", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.result.status, 0);
        assert.deepStrictEqual(env.state.heartbeats.at(-1), {
            monitor_id: 7,
            status: 0,
            ping: 130,
            msg: "Request timed out",
        });
    });

    test("check-now sends assigned Pushover notifications on down transitions", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                primaryBaseURL: "https://uptime.worker",
                serverTimezone: "America/Detroit",
            },
            monitors: [
                {
                    id: 215,
                    name: "Ring | Inseego 5G",
                    type: "ping",
                    hostname: "ring-inseego.wgs",
                    active: 1,
                    timeout: 48,
                    interval: 60,
                    network_profile_id: null,
                    config_json: JSON.stringify({ maxretries: 0 }),
                },
            ],
            heartbeats: [
                {
                    monitor_id: 215,
                    status: 1,
                    ping: 120,
                    msg: "120 ms",
                    checked_at: "2026-05-27 20:25:36",
                },
            ],
            notifications: [
                {
                    id: 3,
                    name: "Pushover Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 1,
                    config: JSON.stringify({
                        type: "pushover",
                        pushoveruserkey: "user-key",
                        pushoverapptoken: "app-token",
                        pushoversounds: "siren",
                        pushoversounds_up: "pushover",
                        pushoverpriority: "1",
                        pushovertitle: "Worker Alert",
                        pushoverdevice: "phone",
                    }),
                },
            ],
            monitorNotifications: [{ monitor_id: 215, notification_id: 3 }],
            runnerResult: {
                status: 0,
                ping: 48005,
                msg: "Command failed: ping -c 1 -W 2 -w 48 -s 56 -n ring-inseego.wgs",
                response: null,
            },
        });
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ status: 1 });
        };

        try {
            const response = await handleApiRequest(
                adminRequest("https://example.com/api/monitors/215/check-now", { method: "POST" }),
                env
            );
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.strictEqual(body.result.status, 0);
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://api.pushover.net/1/messages.json");

            const requestBody = sentRequests[0].init.body;
            assert.strictEqual(requestBody.get("user"), "user-key");
            assert.strictEqual(requestBody.get("token"), "app-token");
            assert.strictEqual(requestBody.get("sound"), "siren");
            assert.strictEqual(requestBody.get("priority"), "1");
            assert.strictEqual(requestBody.get("title"), "Worker Alert");
            assert.strictEqual(requestBody.get("device"), "phone");
            assert.strictEqual(requestBody.get("url"), "https://uptime.worker/dashboard/215");
            assert.match(
                requestBody.get("message"),
                /^\[Ring \| Inseego 5G\] \[Down\] Command failed: ping -c 1 -W 2 -w 48 -s 56 -n ring-inseego\.wgs/
            );
            assert.match(requestBody.get("message"), /<b>Time \(America\/Detroit\)<\/b>:/);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("check-now sends assigned Teams notifications on recovery transitions", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                primaryBaseURL: "https://uptime.worker/",
                serverTimezone: "UTC",
            },
            monitors: [
                {
                    id: 216,
                    name: "Corporate",
                    type: "http",
                    url: "https://corp.example.test/health",
                    active: 1,
                    timeout: 30,
                    interval: 60,
                    network_profile_id: null,
                    config_json: JSON.stringify({ maxretries: 0 }),
                },
            ],
            heartbeats: [
                {
                    monitor_id: 216,
                    status: 0,
                    ping: 30000,
                    msg: "Timeout",
                    checked_at: "2026-05-27 20:25:36",
                },
            ],
            notifications: [
                {
                    id: 4,
                    name: "Teams Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 0,
                    config: JSON.stringify({
                        type: "teams",
                        webhookUrl: "https://example.webhook.office.com/services/example",
                    }),
                },
            ],
            monitorNotifications: [{ monitor_id: 216, notification_id: 4 }],
            runnerResult: {
                status: 1,
                ping: 42,
                msg: "200 - OK",
                response: null,
            },
        });
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ ok: true });
        };

        try {
            const response = await handleApiRequest(
                adminRequest("https://example.com/api/monitors/216/check-now", { method: "POST" }),
                env
            );
            const body = await response.json();

            assert.strictEqual(response.status, 200);
            assert.strictEqual(body.result.status, 1);
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://example.webhook.office.com/services/example");
            assert.strictEqual(sentRequests[0].init.headers["content-type"], "application/json");

            const payload = JSON.parse(sentRequests[0].init.body);
            assert.strictEqual(payload.summary, "[Corporate] is back online");
            assert.strictEqual(payload.attachments[0].content.body[0].items[0].text, "**[Corporate] is back online**");
            assert.deepStrictEqual(payload.attachments[0].content.body[1].facts.slice(0, 3), [
                { title: "Description", value: "200 - OK" },
                { title: "Monitor", value: "Corporate" },
                { title: "Target", value: "[https://corp.example.test/health](https://corp.example.test/health)" },
            ]);
            assert.deepStrictEqual(payload.attachments[0].content.body.at(-1).actions[0], {
                type: "Action.OpenUrl",
                title: "Visit Uptime Worker",
                url: "https://uptime.worker/dashboard/216",
            });
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("check-now skips heartbeat writes when the runner call fails", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    hostname: null,
                    port: null,
                    method: "GET",
                    timeout: 48,
                    network_profile_id: null,
                },
            ],
            runnerResponseStatus: 500,
            runnerResult: { error: "container unavailable" },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, {
            skipped: true,
            status: null,
            ping: null,
            msg: "Runner check failed with 500: container unavailable",
            response: null,
        });
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("check-now skips paused monitors without runner checks or heartbeat writes", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Paused LTE",
                    type: "ping",
                    hostname: "192.0.2.7",
                    active: 0,
                },
            ],
            runnerResult: { status: 0, ping: 120, msg: "Request timed out", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body.result, {
            skipped: true,
            status: null,
            ping: null,
            msg: "Monitor is paused",
            response: null,
        });
        assert.deepStrictEqual(env.state.runnerJobs, []);
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("queue consumer skips stale messages for paused monitors", async () => {
        const { consumeQueue } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Paused LTE",
                    type: "ping",
                    hostname: "192.0.2.7",
                    active: 0,
                },
            ],
            runnerResult: { status: 0, ping: 120, msg: "Request timed out", response: null },
        });
        const acknowledged = [];

        const result = await consumeQueue({
            messages: [
                {
                    body: { monitorId: 7 },
                    ack() {
                        acknowledged.push(7);
                    },
                },
            ],
        }, env);

        assert.strictEqual(result.paused, false);
        assert.strictEqual(result.consumed, 1);
        assert.deepStrictEqual(acknowledged, [7]);
        assert.deepStrictEqual(env.state.runnerJobs, []);
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("new Worker versions pause scheduled monitor enqueueing", async () => {
        const { enqueueDueMonitors } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            workerVersionId: "version-a",
            deployMonitorPauseSeconds: "120",
        });

        const result = await enqueueDueMonitors(env);

        assert.strictEqual(result.paused, true);
        assert.strictEqual(env.MONITOR_QUEUE.sent.length, 0);
        assert.strictEqual(env.state.settings.deployMonitorPause.versionId, "version-a");
        assert.match(env.state.settings.deployMonitorPause.pauseUntil, /^\d{4}-\d{2}-\d{2}T/);
    });

    test("existing Worker versions keep scheduled checks paused until pauseUntil", async () => {
        const { enqueueDueMonitors } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: new Date(Date.now() + 60_000).toISOString(),
                },
            },
            workerVersionId: "version-a",
            deployMonitorPauseSeconds: "120",
        });

        const result = await enqueueDueMonitors(env);

        assert.strictEqual(result.paused, true);
        assert.strictEqual(env.MONITOR_QUEUE.sent.length, 0);
    });

    test("existing Worker versions enqueue scheduled checks after pauseUntil expires", async () => {
        const { enqueueDueMonitors } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: new Date(Date.now() - 60_000).toISOString(),
                },
            },
            workerVersionId: "version-a",
            deployMonitorPauseSeconds: "120",
        });

        const result = await enqueueDueMonitors(env);

        assert.strictEqual(result.paused, false);
        assert.deepStrictEqual(env.MONITOR_QUEUE.sent, [
            {
                monitorId: 7,
                queuedAt: env.MONITOR_QUEUE.sent[0].queuedAt,
            },
        ]);
    });

    test("scheduled monitor enqueueing only sends monitors due by interval", async () => {
        const { enqueueDueMonitors } = await import("../../../cloudflare/worker/api.mjs");
        const now = Date.parse("2026-05-26T12:00:00Z");
        const env = createEnv({
            now,
            monitors: [
                {
                    id: 7,
                    name: "Recently checked",
                    type: "http",
                    url: "https://recent.example.test",
                    interval: 300,
                    active: 1,
                },
                {
                    id: 8,
                    name: "Due check",
                    type: "http",
                    url: "https://due.example.test",
                    interval: 60,
                    active: 1,
                },
                {
                    id: 9,
                    name: "Never checked",
                    type: "ping",
                    hostname: "192.0.2.9",
                    interval: 300,
                    active: 1,
                },
                {
                    id: 10,
                    name: "Group",
                    type: "group",
                    interval: 60,
                    active: 1,
                },
                {
                    id: 11,
                    name: "Paused",
                    type: "http",
                    url: "https://paused.example.test",
                    interval: 60,
                    active: 0,
                },
            ],
            heartbeats: [
                {
                    id: 1,
                    monitor_id: 7,
                    status: 1,
                    checked_at: new Date(now - 60_000).toISOString(),
                },
                {
                    id: 2,
                    monitor_id: 8,
                    status: 1,
                    checked_at: new Date(now - 61_000).toISOString(),
                },
            ],
        });

        const result = await enqueueDueMonitors(env);

        assert.strictEqual(result.paused, false);
        assert.strictEqual(result.enqueued, 2);
        assert.deepStrictEqual(env.MONITOR_QUEUE.sent.map((message) => message.monitorId), [8, 9]);
    });

    test("queue consumer acknowledges messages without runner checks during deploy pause", async () => {
        const { consumeQueue } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: new Date(Date.now() + 60_000).toISOString(),
                },
            },
            workerVersionId: "version-a",
        });
        const acknowledged = [];

        const result = await consumeQueue({
            messages: [
                {
                    body: { monitorId: 7 },
                    ack() {
                        acknowledged.push(7);
                    },
                },
            ],
        }, env);

        assert.strictEqual(result.paused, true);
        assert.deepStrictEqual(acknowledged, [7]);
        assert.deepStrictEqual(env.state.runnerJobs, []);
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("check-now skips runner checks and heartbeat writes during deploy pause", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: new Date(Date.now() + 60_000).toISOString(),
                },
            },
            workerVersionId: "version-a",
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.result.skipped, true);
        assert.strictEqual(body.result.status, null);
        assert.match(body.result.msg, /paused during Worker deployment/);
        assert.deepStrictEqual(env.state.runnerJobs, []);
        assert.deepStrictEqual(env.state.heartbeats, []);
    });

    test("changed Worker versions refresh the deploy pause window", async () => {
        const { enqueueDueMonitors } = await import("../../../cloudflare/worker/api.mjs");
        const oldPauseUntil = new Date(Date.now() - 60_000).toISOString();
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Marketing Dash",
                    type: "http",
                    url: "https://marketing.wgsglobal.app/",
                    active: 1,
                },
            ],
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: oldPauseUntil,
                },
            },
            workerVersionId: "version-b",
            deployMonitorPauseSeconds: "120",
        });

        const result = await enqueueDueMonitors(env);

        assert.strictEqual(result.paused, true);
        assert.strictEqual(env.MONITOR_QUEUE.sent.length, 0);
        assert.strictEqual(env.state.settings.deployMonitorPause.versionId, "version-b");
        assert.notStrictEqual(env.state.settings.deployMonitorPause.pauseUntil, oldPauseUntil);
    });

    test("Twingate health alert sends selected notifications after the startup threshold", async () => {
        const workerApi = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                primaryBaseURL: "https://uptime.worker",
                serverTimezone: "UTC",
                twingateAlertEnabled: true,
                twingateAlertNotificationIDList: {
                    3: true,
                    4: false,
                },
                twingateAlertThresholdMinutes: 5,
            },
            runnerStatus: {
                configured: true,
                starting: true,
                running: false,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "off",
                lastError: "twingated exited before proxy became ready",
            },
            notifications: [
                {
                    id: 3,
                    name: "Pushover Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 1,
                    config: JSON.stringify({
                        type: "pushover",
                        pushoveruserkey: "user-key",
                        pushoverapptoken: "app-token",
                        pushoversounds: "siren",
                        pushoverpriority: "1",
                        pushovertitle: "Worker Alert",
                    }),
                },
                {
                    id: 4,
                    name: "Teams Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 0,
                    config: JSON.stringify({
                        type: "teams",
                        webhookUrl: "https://example.webhook.office.com/services/example",
                    }),
                },
            ],
        });
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ ok: true });
        };

        try {
            assert.strictEqual(typeof workerApi.checkTwingateHealthAlert, "function");

            const firstResult = await workerApi.checkTwingateHealthAlert(env, new Date("2026-05-27T12:00:00Z"));
            assert.strictEqual(firstResult.degraded, true);
            assert.strictEqual(firstResult.notified, false);
            assert.strictEqual(env.state.settings.twingateAlertState.firstDegradedAt, "2026-05-27T12:00:00.000Z");
            assert.strictEqual(sentRequests.length, 0);

            const secondResult = await workerApi.checkTwingateHealthAlert(env, new Date("2026-05-27T12:06:00Z"));
            assert.strictEqual(secondResult.degraded, true);
            assert.strictEqual(secondResult.notified, true);
            assert.strictEqual(env.state.settings.twingateAlertState.notifiedStatus, "degraded");
            assert.strictEqual(env.state.settings.twingateAlertState.lastNotificationAt, "2026-05-27T12:06:00.000Z");
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://api.pushover.net/1/messages.json");
            assert.match(sentRequests[0].init.body.get("message"), /^\[Twingate\] \[Down\]/);
            assert.match(sentRequests[0].init.body.get("message"), /twingated exited before proxy became ready/);

            const thirdResult = await workerApi.checkTwingateHealthAlert(env, new Date("2026-05-27T12:07:00Z"));
            assert.strictEqual(thirdResult.degraded, true);
            assert.strictEqual(thirdResult.notified, false);
            assert.strictEqual(sentRequests.length, 1);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("Twingate health alert sends a recovery notification after a degraded alert", async () => {
        const { checkTwingateHealthAlert } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                serverTimezone: "UTC",
                twingateAlertEnabled: true,
                twingateAlertNotificationIDList: {
                    4: true,
                },
                twingateAlertThresholdMinutes: 5,
                twingateAlertState: {
                    firstDegradedAt: "2026-05-27T12:00:00.000Z",
                    notifiedStatus: "degraded",
                    lastNotificationAt: "2026-05-27T12:06:00.000Z",
                },
            },
            runnerStatus: {
                configured: true,
                starting: false,
                running: true,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "off",
                lastError: null,
            },
            notifications: [
                {
                    id: 4,
                    name: "Teams Alert",
                    active: 1,
                    user_id: 1,
                    is_default: 0,
                    config: JSON.stringify({
                        type: "teams",
                        webhookUrl: "https://example.webhook.office.com/services/example",
                    }),
                },
            ],
        });
        const originalFetch = globalThis.fetch;
        const sentRequests = [];
        globalThis.fetch = async (url, init = {}) => {
            sentRequests.push({ url, init });
            return Response.json({ ok: true });
        };

        try {
            assert.strictEqual(typeof checkTwingateHealthAlert, "function");

            const result = await checkTwingateHealthAlert(env, new Date("2026-05-27T12:08:00Z"));

            assert.strictEqual(result.degraded, false);
            assert.strictEqual(result.notified, true);
            assert.strictEqual(env.state.settings.twingateAlertState.notifiedStatus, "healthy");
            assert.strictEqual(sentRequests.length, 1);
            assert.strictEqual(sentRequests[0].url, "https://example.webhook.office.com/services/example");

            const payload = JSON.parse(sentRequests[0].init.body);
            assert.strictEqual(payload.summary, "[Twingate] is back online");
            assert.deepStrictEqual(payload.attachments[0].content.body[1].facts.slice(0, 2), [
                { title: "Description", value: "Twingate is running again." },
                { title: "Monitor", value: "Twingate" },
            ]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test("check-now adds ACCESS_SECRET header to HTTP monitor jobs without saving it", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            accessSecret: "long-random-secret",
            monitors: [
                {
                    id: 8,
                    name: "Protected HTTP",
                    type: "http",
                    url: "https://protected.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: "{\"Accept\":\"application/json\"}",
                    timeout: 5,
                    network_profile_id: null,
                },
            ],
            runnerResult: { status: 1, ping: 18, msg: "200 - OK", response: "ok" },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/8/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(JSON.parse(env.state.runnerJobs[0].monitor.headers), {
            Accept: "application/json",
            "X-Uptime-Worker-Token": "long-random-secret",
        });
        assert.strictEqual(env.state.monitors[0].headers, "{\"Accept\":\"application/json\"}");
    });

    test("check-now does not add ACCESS_SECRET header when monitor uses an active proxy", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            accessSecret: "long-random-secret",
            monitors: [
                {
                    id: 9,
                    name: "Proxied Protected HTTP",
                    type: "http",
                    url: "https://protected.example.test",
                    hostname: null,
                    port: null,
                    method: "GET",
                    headers: "{\"Accept\":\"application/json\"}",
                    timeout: 5,
                    network_profile_id: null,
                    proxy_id: 4,
                },
            ],
            proxies: [
                {
                    id: 4,
                    user_id: 1,
                    protocol: "http",
                    host: "proxy.example.test",
                    port: 8080,
                    auth: 0,
                    username: null,
                    password: null,
                    active: 1,
                    default: 0,
                },
            ],
            runnerResult: { status: 1, ping: 18, msg: "200 - OK", response: "ok" },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/9/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(JSON.parse(env.state.runnerJobs[0].monitor.headers), {
            Accept: "application/json",
        });
        assert.strictEqual(env.state.runnerJobs[0].monitor.proxy.id, 4);
    });
});

/**
 * Create a mock Worker environment for API handler tests.
 * @param {object} initial Initial mock state.
 * @returns {object} Mock Worker environment.
 */
function createEnv(initial) {
    const state = {
        now: initial.now,
        profiles: initial.profiles || [],
        monitors: initial.monitors || [],
        heartbeats: initial.heartbeats || [],
        notifications: initial.notifications || [],
        monitorNotifications: initial.monitorNotifications || [],
        tags: initial.tags || [],
        monitorTags: initial.monitorTags || [],
        proxies: initial.proxies || [],
        dockerHosts: initial.dockerHosts || [],
        remoteBrowsers: initial.remoteBrowsers || [],
        settings: initial.settings || {},
        queries: [],
        runnerJobs: [],
        runnerResult: initial.runnerResult,
        runnerResults: initial.runnerResults ? [...initial.runnerResults] : null,
        runnerResponseStatus: initial.runnerResponseStatus || 200,
        runnerStatusResponseStatus: initial.runnerStatusResponseStatus || 200,
        runnerStatus: initial.runnerStatus || {
            configured: false,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: null,
            lastError: null,
        },
        nextMonitorId: initial.nextMonitorId || 1,
        nextHeartbeatId: initial.nextHeartbeatId || 1,
        nextNotificationId: initial.nextNotificationId || 1,
        nextTagId: initial.nextTagId || 1,
        nextMonitorTagId: initial.nextMonitorTagId || 1,
        nextProxyId: initial.nextProxyId || 1,
        nextDockerHostId: initial.nextDockerHostId || 1,
        nextRemoteBrowserId: initial.nextRemoteBrowserId || 1,
        missingConfigJsonColumn: Boolean(initial.missingConfigJsonColumn),
        missingParentColumn: Boolean(initial.missingParentColumn),
        missingProxyColumn: Boolean(initial.missingProxyColumn),
        missingNotificationTables: Boolean(initial.missingNotificationTables),
        missingTagTables: Boolean(initial.missingTagTables),
        runnerStatusNeverResolves: Boolean(initial.runnerStatusNeverResolves),
    };

    return {
        state,
        ADMIN_API_TOKEN: "adminToken" in initial ? initial.adminToken : "test-token",
        ACCESS_SECRET: initial.accessSecret,
        CF_VERSION_METADATA: initial.workerVersionId ? { id: initial.workerVersionId } : undefined,
        DEPLOY_MONITOR_PAUSE_SECONDS: initial.deployMonitorPauseSeconds,
        CF_ACCESS_TEAM_DOMAIN: initial.accessTeamDomain || initial.accessAuth?.teamDomain,
        CF_ACCESS_AUD: initial.accessAudience || initial.accessAuth?.audience,
        CF_ACCESS_CERTS_JSON: initial.accessAuth?.certsJson,
        DB: {
            prepare(sql) {
                state.queries.push(sql);
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
                            if (state.runnerStatusNeverResolves) {
                                return new Promise(() => {});
                            }
                            return Response.json(state.runnerStatus, { status: state.runnerStatusResponseStatus });
                        }
                        state.runnerJobs.push(await request.json());
                        const runnerResult = state.runnerResults
                            ? state.runnerResults.shift()
                            : state.runnerResult;
                        return Response.json(runnerResult, { status: state.runnerResponseStatus });
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

/**
 * Create the default local Worker auth user for tests.
 * @param {(request: Request, env: object) => Promise<Response>} handleApiRequest Worker API handler.
 * @param {object} env Test Worker environment.
 * @returns {Promise<void>}
 */
async function createLocalUser(handleApiRequest, env) {
    const response = await handleApiRequest(
        adminRequest("https://example.com/api/auth/local-user", {
            method: "PUT",
            body: JSON.stringify({
                username: "admin",
                newPassword: "password123",
            }),
        }),
        env
    );
    assert.strictEqual(response.status, 200);
}

/**
 * Create a signed Cloudflare Access JWT fixture.
 * @param {object} options Fixture options.
 * @returns {Promise<object>} Access auth fixture.
 */
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

/**
 * Encode an object as JWT-safe base64url JSON.
 * @param {object} value Value to encode.
 * @returns {string} Encoded value.
 */
function base64UrlEncodeJson(value) {
    return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * Encode bytes as base64url.
 * @param {Uint8Array} bytes Bytes to encode.
 * @returns {string} Encoded value.
 */
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
                if (!state.missingProxyColumn) {
                    columns.push("proxy_id");
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
            if (sql.includes("FROM monitor_notification")) {
                if (state.missingNotificationTables) {
                    throw new Error("no such table: monitor_notification");
                }
                let results = [...state.monitorNotifications];
                if (sql.includes("WHERE monitor_id IN")) {
                    const ids = this.values.map(Number);
                    results = results.filter((row) => ids.includes(Number(row.monitor_id)));
                }
                return { results };
            }
            if (sql.includes("FROM notification")) {
                if (state.missingNotificationTables) {
                    throw new Error("no such table: notification");
                }
                return { results: [...state.notifications] };
            }
            if (sql.includes("FROM monitor_tag")) {
                if (state.missingTagTables) {
                    throw new Error("no such table: monitor_tag");
                }
                const tagById = new Map(state.tags.map((tag) => [Number(tag.id), tag]));
                let results = state.monitorTags.map((monitorTag) => ({
                    ...monitorTag,
                    name: tagById.get(Number(monitorTag.tag_id))?.name || "",
                    color: tagById.get(Number(monitorTag.tag_id))?.color || "",
                }));
                if (sql.includes("WHERE mt.monitor_id IN")) {
                    const ids = this.values.map(Number);
                    results = results.filter((row) => ids.includes(Number(row.monitor_id)));
                }
                results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
                return { results };
            }
            if (sql.includes("FROM tag")) {
                if (state.missingTagTables) {
                    throw new Error("no such table: tag");
                }
                return { results: [...state.tags].sort((a, b) => String(a.name).localeCompare(String(b.name))) };
            }
            if (sql.includes("FROM proxy")) {
                return { results: [...state.proxies] };
            }
            if (sql.includes("FROM docker_host")) {
                return { results: [...state.dockerHosts] };
            }
            if (sql.includes("FROM remote_browser")) {
                return { results: [...state.remoteBrowsers] };
            }
            if (sql.includes("WITH requested_monitor_ids") && sql.includes("FROM requested_monitor_ids")) {
                const ids = this.values.map(Number);
                const results = [];
                for (const id of ids) {
                    const latestHeartbeat = state.heartbeats
                        .filter((heartbeat) => Number(heartbeat.monitor_id) === id)
                        .toSorted((a, b) => {
                            const checkedAtCompare = String(b.checked_at).localeCompare(String(a.checked_at));
                            if (checkedAtCompare !== 0) {
                                return checkedAtCompare;
                            }
                            return Number(b.id || 0) - Number(a.id || 0);
                        })[0];
                    if (latestHeartbeat) {
                        results.push(latestHeartbeat);
                    }
                }
                return { results };
            }
            if (sql.includes("FROM monitors") && sql.includes("NOT EXISTS") && sql.includes("FROM heartbeats")) {
                return { results: state.monitors.filter((monitor) => isMonitorDueForEnqueue(monitor, state)) };
            }
            if (sql.includes("FROM monitors")) {
                if (sql.includes("WHERE id = ?")) {
                    return { results: state.monitors.filter((monitor) => monitor.id === Number(this.values[0])) };
                }
                return { results: [...state.monitors] };
            }
            if (sql.includes("important_events") && sql.includes("LAG(status) OVER")) {
                return { results: buildImportantHeartbeatQueryResults(sql, this.values, state) };
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
            if (sql.includes("FROM app_settings")) {
                const value = state.settings[this.values[0]];
                return value === undefined ? null : { value: JSON.stringify(value) };
            }
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
            if (sql.includes("FROM tag")) {
                if (state.missingTagTables) {
                    throw new Error("no such table: tag");
                }
                const id = Number(this.values[0]);
                return state.tags.find((tag) => tag.id === id) || null;
            }
            if (sql.includes("FROM proxy")) {
                if (sql.includes("WHERE \"default\" = 1")) {
                    return state.proxies.find((proxy) => proxy.default && proxy.active) || null;
                }
                const id = Number(this.values[0]);
                return state.proxies.find((proxy) => proxy.id === id) || null;
            }
            if (sql.includes("FROM docker_host")) {
                const id = Number(this.values[0]);
                return state.dockerHosts.find((dockerHost) => dockerHost.id === id) || null;
            }
            if (sql.includes("FROM remote_browser")) {
                const id = Number(this.values[0]);
                return state.remoteBrowsers.find((remoteBrowser) => remoteBrowser.id === id) || null;
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
            if (sql.includes("CREATE TABLE IF NOT EXISTS tag")) {
                state.missingTagTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS monitor_tag")) {
                state.missingTagTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS monitor_tag_monitor_id_index")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS monitor_tag_tag_id_index")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS proxy")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_proxy_default")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS docker_host")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS remote_browser")) {
                return { success: true };
            }
            if (sql.includes("ALTER TABLE monitors ADD COLUMN proxy_id")) {
                state.missingProxyColumn = false;
                for (const monitor of state.monitors) {
                    monitor.proxy_id = monitor.proxy_id ?? null;
                }
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_monitors_proxy_id")) {
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
            if (sql.includes("INSERT INTO tag")) {
                const [name, color] = this.values;
                const id = state.nextTagId++;
                state.tags.push({
                    id,
                    name,
                    color,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("UPDATE tag")) {
                const [name, color, id] = this.values;
                const tag = state.tags.find((candidate) => candidate.id === Number(id));
                if (tag) {
                    Object.assign(tag, {
                        name,
                        color,
                    });
                }
                return { success: true };
            }
            if (sql.includes("UPDATE proxy SET \"default\" = 0")) {
                for (const proxy of state.proxies) {
                    proxy.default = 0;
                }
                return { success: true };
            }
            if (sql.includes("INSERT INTO proxy")) {
                const [userId, protocol, host, port, auth, username, password, active, isDefault] = this.values;
                const id = state.nextProxyId++;
                state.proxies.push({
                    id,
                    user_id: userId,
                    protocol,
                    host,
                    port,
                    auth,
                    username,
                    password,
                    active,
                    default: isDefault,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("INSERT INTO docker_host")) {
                const [userId, name, dockerDaemon, dockerType] = this.values;
                const id = state.nextDockerHostId++;
                state.dockerHosts.push({
                    id,
                    user_id: userId,
                    name,
                    docker_daemon: dockerDaemon,
                    docker_type: dockerType,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("INSERT INTO remote_browser")) {
                const [userId, name, url] = this.values;
                const id = state.nextRemoteBrowserId++;
                state.remoteBrowsers.push({
                    id,
                    user_id: userId,
                    name,
                    url,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("UPDATE proxy")) {
                const [protocol, host, port, auth, username, password, active, isDefault, id] = this.values;
                const proxy = state.proxies.find((candidate) => candidate.id === Number(id));
                if (proxy) {
                    Object.assign(proxy, {
                        protocol,
                        host,
                        port,
                        auth,
                        username,
                        password,
                        active,
                        default: isDefault,
                    });
                }
                return { success: true };
            }
            if (sql.includes("UPDATE docker_host")) {
                const [name, dockerDaemon, dockerType, id] = this.values;
                const dockerHost = state.dockerHosts.find((candidate) => candidate.id === Number(id));
                if (dockerHost) {
                    Object.assign(dockerHost, {
                        name,
                        docker_daemon: dockerDaemon,
                        docker_type: dockerType,
                    });
                }
                return { success: true };
            }
            if (sql.includes("UPDATE remote_browser")) {
                const [name, url, id] = this.values;
                const remoteBrowser = state.remoteBrowsers.find((candidate) => candidate.id === Number(id));
                if (remoteBrowser) {
                    Object.assign(remoteBrowser, {
                        name,
                        url,
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
            if (sql.includes("INSERT INTO monitor_tag")) {
                const [tagId, monitorId, value] = this.values;
                const id = state.nextMonitorTagId++;
                state.monitorTags.push({
                    id,
                    monitor_id: Number(monitorId),
                    tag_id: Number(tagId),
                    value,
                });
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("INSERT INTO monitors")) {
                const hasParentColumn = /network_profile_id,\s*parent,\s*config_json/.test(sql);
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
                    parentOrConfigJson,
                    configJsonOrProxyId,
                    proxyIdValue,
                ] = this.values;
                const parent = hasParentColumn ? parentOrConfigJson : null;
                const configJson = hasParentColumn ? configJsonOrProxyId : parentOrConfigJson;
                const proxyId = hasParentColumn ? proxyIdValue : configJsonOrProxyId;
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
                    proxy_id: proxyId,
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
                if (sql.includes("SET proxy_id = NULL")) {
                    const [proxyId] = this.values;
                    for (const monitor of state.monitors) {
                        if (monitor.proxy_id === Number(proxyId)) {
                            monitor.proxy_id = null;
                        }
                    }
                    return { success: true };
                }
                if (sql.includes("SET proxy_id = ?")) {
                    const [proxyId] = this.values;
                    for (const monitor of state.monitors) {
                        monitor.proxy_id = proxyId;
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
                const hasParentColumn = /network_profile_id = \?, parent = \?, config_json/.test(sql);
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
                    parentOrConfigJson,
                    configJsonOrProxyId,
                    proxyIdOrId,
                    maybeId,
                ] = this.values;
                const parent = hasParentColumn ? parentOrConfigJson : null;
                const configJson = hasParentColumn ? configJsonOrProxyId : parentOrConfigJson;
                const proxyId = hasParentColumn ? proxyIdOrId : configJsonOrProxyId;
                const id = hasParentColumn ? maybeId : proxyIdOrId;
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
                        proxy_id: proxyId,
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
            if (sql.includes("DELETE FROM monitor_tag")) {
                if (sql.includes("WHERE tag_id = ? AND monitor_id = ? AND value = ?")) {
                    const [tagId, monitorId, value] = this.values;
                    state.monitorTags = state.monitorTags.filter(
                        (row) =>
                            row.tag_id !== Number(tagId) ||
                            row.monitor_id !== Number(monitorId) ||
                            row.value !== value
                    );
                } else if (sql.includes("WHERE tag_id = ?")) {
                    const id = Number(this.values[0]);
                    state.monitorTags = state.monitorTags.filter((row) => row.tag_id !== id);
                } else {
                    const id = Number(this.values[0]);
                    state.monitorTags = state.monitorTags.filter((row) => row.monitor_id !== id);
                }
                return { success: true };
            }
            if (sql.includes("DELETE FROM notification")) {
                const id = Number(this.values[0]);
                state.notifications = state.notifications.filter((notification) => notification.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM tag")) {
                const id = Number(this.values[0]);
                state.tags = state.tags.filter((tag) => tag.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM proxy")) {
                const id = Number(this.values[0]);
                state.proxies = state.proxies.filter((proxy) => proxy.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM docker_host")) {
                const id = Number(this.values[0]);
                state.dockerHosts = state.dockerHosts.filter((dockerHost) => dockerHost.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM remote_browser")) {
                const id = Number(this.values[0]);
                state.remoteBrowsers = state.remoteBrowsers.filter((remoteBrowser) => remoteBrowser.id !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM heartbeats")) {
                if (sql.includes("WHERE checked_at < ?")) {
                    const cutoff = this.values[0];
                    state.heartbeats = state.heartbeats.filter((heartbeat) => heartbeat.checked_at >= cutoff);
                    return { success: true };
                }
                if (sql.includes("WHERE monitor_id = ?")) {
                    const monitorId = Number(this.values[0]);
                    state.heartbeats = state.heartbeats.filter((heartbeat) => heartbeat.monitor_id !== monitorId);
                    return { success: true };
                }
                state.heartbeats = [];
                return { success: true };
            }
            if (sql.includes("INSERT INTO heartbeats")) {
                const [monitorId, status, ping, msg, responseR2Key] = this.values;
                const heartbeat = {
                    monitor_id: Number(monitorId),
                    status,
                    ping,
                    msg,
                };
                Object.defineProperties(heartbeat, {
                    id: {
                        value: state.nextHeartbeatId++,
                    },
                    response_r2_key: {
                        value: responseR2Key,
                    },
                    checked_at: {
                        value: new Date(state.now || Date.now()).toISOString(),
                    },
                });
                state.heartbeats.push(heartbeat);
                return { success: true };
            }
            return { success: true };
        },
    };
    return statement;
}

function isMonitorDueForEnqueue(monitor, state) {
    if (Number(monitor.active) !== 1 || monitor.type === "group") {
        return false;
    }
    const latestHeartbeat = latestHeartbeatForMonitor(state.heartbeats, monitor.id);
    if (!latestHeartbeat) {
        return true;
    }
    const checkedAt = new Date(latestHeartbeat.checked_at).getTime();
    if (!Number.isFinite(checkedAt)) {
        return true;
    }
    const intervalSeconds = Number(monitor.interval) > 0 ? Number(monitor.interval) : 60;
    const now = state.now || Date.now();
    return now - checkedAt >= intervalSeconds * 1000;
}

function latestHeartbeatForMonitor(heartbeats, monitorId) {
    return heartbeats
        .filter((heartbeat) => Number(heartbeat.monitor_id) === Number(monitorId))
        .toSorted((a, b) => {
            const checkedAtCompare = String(b.checked_at || "").localeCompare(String(a.checked_at || ""));
            if (checkedAtCompare !== 0) {
                return checkedAtCompare;
            }
            return Number(b.id || 0) - Number(a.id || 0);
        })[0] || null;
}

function buildImportantHeartbeatQueryResults(sql, values, state) {
    const monitorIdFilter = sql.includes("AND h.monitor_id = ?") ? Number(values[0]) : null;
    const limit = Number(values.at(-2));
    const offset = Number(values.at(-1));
    const activeMonitorById = new Map(
        state.monitors
            .filter((monitor) => Number(monitor.active) === 1)
            .map((monitor) => [Number(monitor.id), monitor])
    );
    const rowsByMonitorId = new Map();

    for (const heartbeat of state.heartbeats) {
        const monitorId = Number(heartbeat.monitor_id);
        const monitor = activeMonitorById.get(monitorId);
        if (!monitor || (monitorIdFilter != null && monitorId !== monitorIdFilter)) {
            continue;
        }
        const rows = rowsByMonitorId.get(monitorId) || [];
        rows.push({
            ...heartbeat,
            status: effectiveTestHeartbeatStatus(heartbeat.status, monitor),
        });
        rowsByMonitorId.set(monitorId, rows);
    }

    const importantHeartbeats = [];
    for (const rows of rowsByMonitorId.values()) {
        let previousStatus = null;
        for (const heartbeat of rows.toSorted(compareTestHeartbeatsOldestFirst)) {
            const status = Number(heartbeat.status);
            if (status === 0 || status === 2 || (status === 1 && (previousStatus === 0 || previousStatus === 2))) {
                importantHeartbeats.push(heartbeat);
            }
            previousStatus = status;
        }
    }

    const sortedHeartbeats = importantHeartbeats.toSorted(compareTestHeartbeatsNewestFirst);
    return sortedHeartbeats.slice(offset, offset + limit).map((heartbeat) => ({
        total_count: sortedHeartbeats.length,
        monitor_id: heartbeat.monitor_id,
        status: heartbeat.status,
        ping: heartbeat.ping,
        msg: heartbeat.msg,
        checked_at: heartbeat.checked_at,
    }));
}

function effectiveTestHeartbeatStatus(status, monitor) {
    if (!testMonitorIsUpsideDown(monitor)) {
        return status;
    }
    const numericStatus = Number(status);
    if (numericStatus === 1) {
        return 0;
    }
    if (numericStatus === 0) {
        return 1;
    }
    return status;
}

function testMonitorIsUpsideDown(monitor) {
    try {
        return Boolean(JSON.parse(monitor.config_json || "{}").upsideDown);
    } catch (_) {
        return false;
    }
}

function compareTestHeartbeatsOldestFirst(a, b) {
    const checkedAtCompare = String(a.checked_at || "").localeCompare(String(b.checked_at || ""));
    if (checkedAtCompare !== 0) {
        return checkedAtCompare;
    }
    return Number(a.id || 0) - Number(b.id || 0);
}

function compareTestHeartbeatsNewestFirst(a, b) {
    const checkedAtCompare = String(b.checked_at || "").localeCompare(String(a.checked_at || ""));
    if (checkedAtCompare !== 0) {
        return checkedAtCompare;
    }
    const monitorCompare = Number(b.monitor_id || 0) - Number(a.monitor_id || 0);
    if (monitorCompare !== 0) {
        return monitorCompare;
    }
    return Number(b.id || 0) - Number(a.id || 0);
}

/**
 * Extract a TOTP secret from an otpauth URI.
 * @param {string} uri OTP auth URI.
 * @returns {string|null} TOTP secret.
 */
function extractTotpSecret(uri) {
    return new URL(uri).searchParams.get("secret");
}

/**
 * Generate a six-digit TOTP code for tests.
 * @param {string} secret Base32 TOTP secret.
 * @param {number} now Current timestamp in milliseconds.
 * @returns {Promise<string>} Six-digit TOTP code.
 */
async function generateTotp(secret, now = Date.now()) {
    const key = await crypto.subtle.importKey(
        "raw",
        decodeBase32(secret),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );
    const counter = Math.floor(now / 30000);
    const counterBytes = new ArrayBuffer(8);
    const view = new DataView(counterBytes);
    view.setUint32(4, counter);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));
    const offset = signature[signature.length - 1] & 0x0f;
    const code = (
        ((signature[offset] & 0x7f) << 24) |
        ((signature[offset + 1] & 0xff) << 16) |
        ((signature[offset + 2] & 0xff) << 8) |
        (signature[offset + 3] & 0xff)
    ) % 1000000;
    return String(code).padStart(6, "0");
}

/**
 * Decode a base32 secret.
 * @param {string} value Base32 input.
 * @returns {Uint8Array} Decoded bytes.
 * @throws {Error} If the input contains a non-base32 character.
 */
function decodeBase32(value) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const char of String(value || "").toUpperCase().replace(/=+$/g, "")) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw new Error("Invalid base32 character");
        }
        bits += index.toString(2).padStart(5, "0");
    }

    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }
    return new Uint8Array(bytes);
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
