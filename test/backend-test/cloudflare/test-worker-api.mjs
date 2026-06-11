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

    test("D1 migration creates derived dashboard runtime cache tables", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0011_dashboard_runtime_cache.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitor_runtime_summary/);
        assert.match(migrationSql, /monitor_id INTEGER PRIMARY KEY/);
        assert.match(migrationSql, /uptime_24 REAL/);
        assert.match(migrationSql, /uptime_720 REAL/);
        assert.match(migrationSql, /uptime_1y REAL/);
        assert.match(migrationSql, /heartbeat_bar_json TEXT/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitor_event_log/);
        assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS idx_monitor_event_log_checked_at/);
        assert.match(migrationSql, /checked_at DESC, id DESC/);
        assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS idx_monitor_event_log_monitor_checked_at/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS monitor_metric_bucket/);
        assert.match(migrationSql, /PRIMARY KEY \(monitor_id, resolution_seconds, bucket_start\)/);
    });

    test("D1 write-reduction migration adds hot-path indexes and optimizes planner stats", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0013_d1_write_reduction.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_checked_at_id/);
        assert.match(migrationSql, /heartbeats\(monitor_id, checked_at DESC, id DESC\)/);
        assert.match(migrationSql, /CREATE INDEX IF NOT EXISTS idx_monitors_active_type/);
        assert.match(migrationSql, /monitors\(active, type\)/);
        assert.match(migrationSql, /PRAGMA optimize/);
    });

    test("D1 migration creates Worker users, sessions, audit log, and legacy admin migration", async () => {
        const migrationPath = path.join(
            __dirname,
            "../../../cloudflare/migrations/0012_users_rbac.sql"
        );
        const migrationSql = fs.readFileSync(migrationPath, "utf8");

        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS users/);
        assert.match(migrationSql, /username TEXT NOT NULL UNIQUE/);
        assert.match(migrationSql, /role TEXT NOT NULL/);
        assert.match(migrationSql, /password_json TEXT NOT NULL/);
        assert.match(migrationSql, /totp_json TEXT/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS user_sessions/);
        assert.match(migrationSql, /token_hash TEXT NOT NULL UNIQUE/);
        assert.match(migrationSql, /CREATE TABLE IF NOT EXISTS user_audit_log/);
        assert.match(migrationSql, /workerAuthUser/);
        assert.match(migrationSql, /workerAuthTotp/);
        assert.match(migrationSql, /NOT EXISTS \(SELECT 1 FROM users\)/);
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
        assert.strictEqual(wranglerConfig.vars.TWINGATE_TUN, "on");
        assert.strictEqual("TWINGATE_PING_FALLBACK_PORTS" in wranglerConfig.vars, false);
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

    test("runner container receives Twingate TUN defaults and readiness timeout env", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");
        const optionalEnvBlock = workerSource.slice(
            workerSource.indexOf("copyOptionalEnv(this.envVars, env, ["),
            workerSource.indexOf("]);", workerSource.indexOf("copyOptionalEnv(this.envVars, env, ["))
        );

        assert.match(workerSource, /APP_VERSION:\s*resolveAppVersion\(env\)/);
        assert.match(workerSource, /TWINGATE_READY_TIMEOUT_MS:\s*"60000"/);
        assert.match(workerSource, /TWINGATE_RESTART_DELAY_MS:\s*"1000"/);
        assert.match(workerSource, /TWINGATE_TUN:\s*resolveTwingateTunMode\(env\)/);
        assert.match(workerSource, /"TWINGATE_READY_TIMEOUT_MS"/);
        assert.match(workerSource, /"TWINGATE_RESTART_DELAY_MS"/);
        assert.doesNotMatch(workerSource, /TWINGATE_PING_FALLBACK_PORTS/);
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

    test("scheduled Worker uses cadence-gated maintenance runner", async () => {
        const workerPath = path.join(__dirname, "../../../cloudflare/worker/index.mjs");
        const workerSource = fs.readFileSync(workerPath, "utf8");

        assert.match(workerSource, /runScheduledMaintenance/);
        assert.match(workerSource, /await runScheduledMaintenance\(_controller,\s*env\)/);
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

    test("Worker UI stores RBAC session context and exposes permission helpers", async () => {
        const socketMixinPath = path.join(__dirname, "../../../src/mixins/socket.js");
        const socketMixinSource = fs.readFileSync(socketMixinPath, "utf8");

        assert.match(socketMixinSource, /currentUser:\s*null/);
        assert.match(socketMixinSource, /currentRole:\s*null/);
        assert.match(socketMixinSource, /currentPermissions:\s*\[\]/);
        assert.match(socketMixinSource, /applyCloudflareWorkerAuthContext\(session\)/);
        assert.match(socketMixinSource, /hasPermission\(permission\)/);
        assert.match(socketMixinSource, /hasAnyPermission\(permissions/);
        assert.match(socketMixinSource, /token:\s*credentials\.token/);
    });

    test("Worker Settings UI exposes Users and Worker 2FA controls through permissions", async () => {
        const settingsPath = path.join(__dirname, "../../../src/pages/Settings.vue");
        const settingsSource = fs.readFileSync(settingsPath, "utf8");
        const securityPath = path.join(__dirname, "../../../src/components/settings/Security.vue");
        const securitySource = fs.readFileSync(securityPath, "utf8");
        const routerPath = path.join(__dirname, "../../../src/router.js");
        const routerSource = fs.readFileSync(routerPath, "utf8");

        assert.match(settingsSource, /hasPermission\("users\.read"\)/);
        assert.match(settingsSource, /menus\.users/);
        assert.match(settingsSource, /"users"/);
        assert.match(routerSource, /settings\/Users\.vue/);
        assert.match(routerSource, /path:\s*"users"/);
        assert.match(securitySource, /Two Factor Authentication/);
        assert.match(securitySource, /hasPermission\("users\.read"\)/);
        assert.match(securitySource, /to="\/settings\/users"/);
    });

    test("Worker Users settings UI calls RBAC user management endpoints", async () => {
        const usersPath = path.join(__dirname, "../../../src/components/settings/Users.vue");
        const usersSource = fs.readFileSync(usersPath, "utf8");

        assert.match(usersSource, /requestCloudflareJson\("\/api\/users"/);
        assert.match(usersSource, /requestCloudflareJson\(`\/api\/users\/\$\{user\.id\}`/);
        assert.match(usersSource, /requestCloudflareJson\(`\/api\/users\/\$\{user\.id\}\/password`/);
        assert.match(usersSource, /requestCloudflareJson\(`\/api\/users\/\$\{user\.id\}\/reset-2fa`/);
        assert.match(usersSource, /hasPermission\("users\.write"\)/);
        assert.match(usersSource, /hasPermission\("users\.delete"\)/);
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
        const bootstrapRequestIndex = socketMixinSource.indexOf(
            "requestCloudflareJson(\"/api/dashboard/bootstrap\")"
        );
        const monitorApplyIndex = socketMixinSource.indexOf(
            "this.applyCloudflareWorkerDashboardState(buildCloudflareWorkerBootstrapState(body, this.heartbeatList));"
        );
        const heartbeatRefreshIndex = socketMixinSource.indexOf(
            "void this.refreshCloudflareWorkerHeartbeatHistories(monitors);"
        );

        assert.match(socketMixinSource, /CLOUDFLARE_DASHBOARD_CACHE_KEY/);
        assert.match(socketMixinSource, /void this\.loadCloudflareWorkerInfo\(\);\s+await this\.refreshCloudflareWorkerAuthSession\(\);/);
        assert.match(socketMixinSource, /readCloudflareDashboardSecondaryCache\(\)/);
        assert.match(socketMixinSource, /this\.applyCloudflareWorkerDashboardCache\(\);\s+await this\.loadCloudflareWorkerData\(\);/);
        assert.match(socketMixinSource, /Promise\.allSettled\(\[/);
        assert.match(socketMixinSource, /dedupeCloudflareDashboardRequest\(\s*"dashboard-bootstrap"/);
        assert.match(socketMixinSource, /refreshHeartbeatHistories = false/);
        assert.match(socketMixinSource, /function buildCloudflareWorkerBootstrapState/);
        assert.doesNotMatch(socketMixinSource, /Promise\.all\(monitors\.map\(async \(monitor\)/);
        assert.notStrictEqual(bootstrapRequestIndex, -1);
        assert.notStrictEqual(monitorApplyIndex, -1);
        assert.notStrictEqual(heartbeatRefreshIndex, -1);
        assert.ok(bootstrapRequestIndex < monitorApplyIndex);
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
            const body = await result.json();
            assert.strictEqual(body.authenticated, false);
            assert.strictEqual(body.username, null);
            assert.strictEqual(body.user, null);
            assert.strictEqual(body.role, null);
            assert.deepStrictEqual(body.permissions, []);
            assert.strictEqual(body.localAuthConfigured, false);
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

    test("lists recent Worker heartbeat histories in one batched dashboard request", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 1, name: "Main", type: "http", url: "https://example.test", active: 1 },
                { id: 2, name: "Backup", type: "http", url: "https://backup.example.test", active: 1 },
            ],
            heartbeats: [
                { id: 1, monitor_id: 1, status: 1, ping: 30, msg: "old", checked_at: "2026-05-11 00:00:00" },
                { id: 2, monitor_id: 1, status: 0, ping: null, msg: "down", checked_at: "2026-05-11 00:01:00" },
                { id: 3, monitor_id: 1, status: 1, ping: 35, msg: "up", checked_at: "2026-05-11 00:02:00" },
                { id: 4, monitor_id: 2, status: 1, ping: 50, msg: "old", checked_at: "2026-05-11 00:00:30" },
                { id: 5, monitor_id: 2, status: 1, ping: 45, msg: "up", checked_at: "2026-05-11 00:01:30" },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/heartbeats/recent", {
                method: "POST",
                body: JSON.stringify({
                    monitorIds: [1, 2],
                    count: 2,
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(Object.keys(body.heartbeatsByMonitorId), ["1", "2"]);
        assert.deepStrictEqual(
            body.heartbeatsByMonitorId[1].map((heartbeat) => heartbeat.msg),
            ["down", "up"]
        );
        assert.deepStrictEqual(
            body.heartbeatsByMonitorId[2].map((heartbeat) => heartbeat.msg),
            ["old", "up"]
        );
        assert.strictEqual(
            env.state.queries.filter((query) => query.includes("ROW_NUMBER() OVER")).length,
            1
        );
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

    test("status page heartbeat data prefers cached runtime summary uptime", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Customer Site", type: "http", url: "https://customer.example.test", active: 1 },
            ],
            settings: {
                "statusPagePublicGroupList:default": [
                    {
                        id: 10,
                        name: "Customer Services",
                        monitorList: [{ id: 7 }],
                    },
                ],
            },
            heartbeats: [
                { monitor_id: 7, status: 1, ping: 12, msg: "200 - OK", checked_at: "2026-05-11 02:30:00" },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                    uptime_24: 0.98,
                },
            ],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/status-page/heartbeat/default"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.uptimeList["7_24"], 0.98);
        assert.strictEqual(body.heartbeatList[7][0].msg, "200 - OK");
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

    test("dashboard bootstrap reads status and summary data from derived runtime tables", async () => {
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
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: 101,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:31:00",
                    avg_ping: 16,
                    uptime_24: 0.98,
                    uptime_720: 0.95,
                    uptime_1y: 0.9,
                    heartbeat_bar_json: JSON.stringify([
                        {
                            monitorID: 7,
                            status: 1,
                            ping: 12,
                            msg: "200 - OK",
                            time: "2026-05-11 02:31:00",
                        },
                    ]),
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/dashboard/bootstrap"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.length, 1);
        assert.strictEqual(body.monitors[0].lastHeartbeat.msg, "200 - OK");
        assert.strictEqual(body.avgPingList[7], 16);
        assert.strictEqual(body.uptimeList["7_24"], 0.98);
        assert.strictEqual(body.uptimeList["7_720"], 0.95);
        assert.strictEqual(body.uptimeList["7_1y"], 0.9);
        assert.strictEqual(body.heartbeatList[7][0].msg, "200 - OK");
        assert.ok(
            env.state.queries.some((sql) => sql.includes("FROM monitor_runtime_summary")),
            "bootstrap should read the derived runtime summary"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("WITH requested_monitor_ids")),
            "bootstrap should verify summaries against the indexed latest heartbeat"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("ORDER BY checked_at ASC")),
            "bootstrap hot path should not rebuild raw heartbeat history when summaries are current"
        );
    });

    test("dashboard bootstrap keeps current upside-down runtime summary status applied once", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Blocked Security Check",
                    type: "http",
                    url: "https://blocked.example.test",
                    active: 1,
                    config_json: JSON.stringify({ upsideDown: true }),
                },
            ],
            heartbeats: [
                {
                    id: 101,
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "Connection refused",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: 101,
                    status: 1,
                    ping: null,
                    msg: "Connection refused",
                    checked_at: "2026-05-11 02:31:00",
                    avg_ping: null,
                    uptime_24: 1,
                    uptime_720: 1,
                    uptime_1y: 1,
                    heartbeat_bar_json: JSON.stringify([
                        {
                            monitorID: 7,
                            status: 1,
                            ping: null,
                            msg: "Connection refused",
                            time: "2026-05-11 02:31:00",
                        },
                    ]),
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/dashboard/bootstrap"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors[0].lastHeartbeat.status, 1);
        assert.strictEqual(body.heartbeatList[7].at(-1).status, 1);
        assert.strictEqual(body.uptimeList["7_24"], 1);
    });

    test("dashboard bootstrap prefers a newer indexed DOWN heartbeat over a stale UP runtime summary", async () => {
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
            ],
            heartbeats: [
                {
                    id: 101,
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    id: 102,
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "Timeout",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: 101,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                    avg_ping: 12,
                    uptime_24: 1,
                    uptime_720: 1,
                    uptime_1y: 1,
                    heartbeat_bar_json: JSON.stringify([
                        {
                            monitorID: 7,
                            status: 1,
                            ping: 12,
                            msg: "200 - OK",
                            time: "2026-05-11 02:30:00",
                        },
                    ]),
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/dashboard/bootstrap"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors[0].lastHeartbeat.status, 0);
        assert.strictEqual(body.monitors[0].lastHeartbeat.msg, "Timeout");
        assert.strictEqual(body.heartbeatList[7].at(-1).status, 0);
        assert.strictEqual(body.heartbeatList[7].at(-1).msg, "Timeout");
    });

    test("dashboard bootstrap falls back to indexed latest status when derived runtime rows are missing", async () => {
        const {
            backfillDashboardRuntimeCaches,
            handleApiRequest,
        } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    active: 1,
                },
            ],
            heartbeats: [
                {
                    id: 101,
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:30:00",
                },
                {
                    id: 102,
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "Timeout",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/dashboard/bootstrap"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors[0].lastHeartbeat.msg, "Timeout");
        assert.ok(
            env.state.queries.some((sql) => sql.includes("WITH requested_monitor_ids")),
            "missing summaries should use the indexed latest heartbeat fallback"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("ORDER BY checked_at ASC")),
            "bootstrap should not rebuild raw heartbeat history on the hot path"
        );
        assert.deepStrictEqual(env.state.monitorRuntimeSummaries, []);

        const result = await backfillDashboardRuntimeCaches(env, { limit: 1 });
        assert.deepStrictEqual(result, { rebuilt: 1 });
        assert.strictEqual(env.state.monitorRuntimeSummaries.length, 1);
        assert.ok(env.state.monitorEventLog.length >= 1);
        assert.ok(env.state.monitorMetricBuckets.length >= 3);
    });

    test("dashboard bootstrap creates missing runtime cache tables before reading summaries", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            missingDashboardRuntimeCacheTables: true,
            monitors: [
                {
                    id: 7,
                    name: "Private HTTP",
                    type: "http",
                    url: "http://private.example.test",
                    active: 1,
                },
            ],
            heartbeats: [
                {
                    id: 1001,
                    monitor_id: 7,
                    status: 1,
                    ping: 12,
                    msg: "200 - OK",
                    checked_at: "2026-05-11 02:31:00",
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/dashboard/bootstrap"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitors.length, 1);
        assert.strictEqual(body.monitors[0].lastHeartbeat.msg, "200 - OK");
        assert.strictEqual(env.state.missingDashboardRuntimeCacheTables, false);
        assert.ok(
            env.state.queries.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS monitor_runtime_summary")),
            "missing runtime summary table should be created"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS monitor_event_log")),
            "missing event-log table should be created"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("CREATE TABLE IF NOT EXISTS monitor_metric_bucket")),
            "missing metric bucket table should be created"
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

    test("lists Worker monitors with legacy ignore_tls column state", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 17,
                    name: "Legacy Self Signed HTTP",
                    type: "http",
                    url: "https://192.168.50.1",
                    active: 1,
                    ignore_tls: 1,
                    config_json: JSON.stringify({}),
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/monitors/17"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.monitor.ignoreTls, true);
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
            monitorRuntimeSummaries: [
                { monitor_id: 7, status: 1, ping: 12, msg: "200 - OK", checked_at: "2026-05-11 02:30:00" },
            ],
            monitorEventLog: [
                { id: 1, heartbeat_id: 2, monitor_id: 8, status: 0, msg: "500 - Error", checked_at: "2026-05-11 02:00:00" },
            ],
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: "2026-05-11 02:30:00",
                    up_count: 1,
                    down_count: 0,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 1,
                    ping_sum: 12,
                    min_ping: 12,
                    max_ping: 12,
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/statistics", { method: "DELETE" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(await response.json(), { ok: true, msg: "Statistics cleared" });
        assert.deepStrictEqual(env.state.heartbeats, []);
        assert.deepStrictEqual(env.state.monitorRuntimeSummaries, []);
        assert.deepStrictEqual(env.state.monitorEventLog, []);
        assert.deepStrictEqual(env.state.monitorMetricBuckets, []);
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

    test("does not allow UI settings saves to overwrite sensitive Worker settings", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                workerAuthSessionSecret: "stored-secret",
            },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/settings", {
                method: "PUT",
                body: JSON.stringify({
                    entryPage: "dashboard",
                    workerAuthSessionSecret: "attacker-secret",
                    workerAuthUser: { username: "attacker" },
                    deployMonitorPause: { versionId: "fake", pauseUntil: "2099-01-01T00:00:00Z" },
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(env.state.settings.workerAuthSessionSecret, "stored-secret");
        assert.strictEqual("workerAuthUser" in env.state.settings, false);
        assert.strictEqual("deployMonitorPause" in env.state.settings, false);
        assert.strictEqual(env.state.settings.entryPage, "dashboard");
    });

    test("only writes UI settings whose stored value changed", async () => {
        const { handleApiRequest, getUiSettings } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});

        const initial = await getUiSettings(env);
        const firstResponse = await handleApiRequest(
            adminRequest("https://example.com/api/settings", {
                method: "PUT",
                body: JSON.stringify(initial),
            }),
            env
        );
        assert.strictEqual(firstResponse.status, 200);

        const writesAfterFirstSave = env.state.queries.filter((sql) => sql.includes("INSERT INTO app_settings")).length;
        const secondResponse = await handleApiRequest(
            adminRequest("https://example.com/api/settings", {
                method: "PUT",
                body: JSON.stringify(await getUiSettings(env)),
            }),
            env
        );
        assert.strictEqual(secondResponse.status, 200);

        const writesAfterSecondSave = env.state.queries.filter((sql) => sql.includes("INSERT INTO app_settings")).length;
        assert.strictEqual(writesAfterSecondSave, writesAfterFirstSave);
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
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.msg, "Local admin login saved");
        assert.strictEqual(body.username, "admin");
        assert.strictEqual(body.user.username, "admin");
        assert.strictEqual(body.role, "admin");
        assert.ok(body.permissions.includes("users.read"));
        assert.strictEqual(body.localAuthConfigured, true);
        assert.strictEqual(env.state.users[0].username, "admin");
        assert.notStrictEqual(JSON.parse(env.state.users[0].password_json).hash, "password123");
        assert.strictEqual(JSON.parse(env.state.users[0].password_json).iterations, 100000);
    });

    test("migrates legacy Worker auth settings into the first D1 admin user", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const legacyPassword = await hashTestWorkerPassword("password123");
        const legacyTotp = {
            secret: "JBSWY3DPEHPK3PXP",
            enabled: true,
            lastToken: null,
            verified: false,
            updatedAt: "2026-01-01T00:00:00.000Z",
        };
        const env = createEnv({
            settings: {
                workerAuthUser: {
                    username: "legacy-admin",
                    password: legacyPassword,
                    updatedAt: "2026-01-01T00:00:00.000Z",
                },
                workerAuthTotp: legacyTotp,
            },
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "legacy-admin",
                    password: "password123",
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { tokenRequired: true });
        assert.strictEqual(env.state.users.length, 1);
        assert.strictEqual(env.state.users[0].username, "legacy-admin");
        assert.strictEqual(env.state.users[0].role, "admin");
        assert.deepStrictEqual(JSON.parse(env.state.users[0].password_json), legacyPassword);
        assert.deepStrictEqual(JSON.parse(env.state.users[0].totp_json), legacyTotp);

        const tokenResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "legacy-admin",
                    password: "password123",
                    token: await generateTotp(legacyTotp.secret),
                }),
            }),
            env
        );
        const tokenBody = await tokenResponse.json();

        assert.strictEqual(tokenResponse.status, 200);
        assert.strictEqual(tokenBody.ok, true);
        assert.strictEqual(tokenBody.user.username, "legacy-admin");
        assert.strictEqual(tokenBody.role, "admin");
        assert.ok(tokenBody.permissions.includes("users.read"));
    });

    test("Worker login returns D1 user role and permissions", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            users: [
                {
                    id: 7,
                    username: "viewer",
                    role: "viewer",
                    active: 1,
                    password_json: JSON.stringify(await hashTestWorkerPassword("password123")),
                    totp_json: null,
                },
            ],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "viewer",
                    password: "password123",
                }),
            }),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.ok, true);
        assert.strictEqual(body.user.id, 7);
        assert.strictEqual(body.user.username, "viewer");
        assert.strictEqual(body.role, "viewer");
        assert.ok(body.permissions.includes("monitors.read"));
        assert.strictEqual(body.permissions.includes("monitors.write"), false);
        assert.strictEqual(body.permissions.includes("users.read"), false);
    });

    test("role permissions return 403 for authenticated users missing route permission", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            users: [
                {
                    id: 8,
                    username: "viewer",
                    role: "viewer",
                    active: 1,
                    password_json: JSON.stringify(await hashTestWorkerPassword("password123")),
                    totp_json: null,
                },
            ],
            monitors: [],
        });
        const loginResponse = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "viewer",
                    password: "password123",
                }),
            }),
            env
        );
        const { token } = await loginResponse.json();

        const readResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                headers: { authorization: `Bearer ${token}` },
            }),
            env
        );
        const writeResponse = await handleApiRequest(
            new Request("https://example.com/api/monitors", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: "Blocked",
                    type: "http",
                    url: "https://blocked.example.test",
                }),
            }),
            env
        );

        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual(writeResponse.status, 403);
        assert.deepStrictEqual(await writeResponse.json(), { error: "Forbidden" });
    });

    test("Worker user management endpoints create, list, update, reset 2FA, rotate password, and delete users", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);
        const adminToken = await loginLocalUser(handleApiRequest, env, "admin", "password123");

        const createResponse = await handleApiRequest(
            bearerRequest(adminToken, "https://example.com/api/users", {
                method: "POST",
                body: JSON.stringify({
                    username: "operator",
                    password: "operator123",
                    role: "operator",
                    active: true,
                }),
            }),
            env
        );
        const createBody = await createResponse.json();

        assert.strictEqual(createResponse.status, 200);
        assert.strictEqual(createBody.user.username, "operator");
        assert.strictEqual(createBody.user.role, "operator");

        const listResponse = await handleApiRequest(bearerRequest(adminToken, "https://example.com/api/users"), env);
        const listBody = await listResponse.json();
        assert.strictEqual(listResponse.status, 200);
        assert.deepStrictEqual(
            listBody.users.map((user) => user.username).sort(),
            ["admin", "operator"]
        );
        assert.strictEqual("password_json" in listBody.users[0], false);

        const getResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${createBody.user.id}`),
            env
        );
        assert.strictEqual(getResponse.status, 200);
        assert.strictEqual((await getResponse.json()).user.role, "operator");

        const updateResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${createBody.user.id}`, {
                method: "PUT",
                body: JSON.stringify({
                    username: "editor",
                    role: "editor",
                    active: true,
                }),
            }),
            env
        );
        assert.strictEqual(updateResponse.status, 200);
        assert.strictEqual((await updateResponse.json()).user.role, "editor");

        const resetTwoFAResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${createBody.user.id}/reset-2fa`, {
                method: "POST",
            }),
            env
        );
        assert.strictEqual(resetTwoFAResponse.status, 200);

        const passwordResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${createBody.user.id}/password`, {
                method: "PATCH",
                body: JSON.stringify({ password: "editor123" }),
            }),
            env
        );
        assert.strictEqual(passwordResponse.status, 200);

        const editorToken = await loginLocalUser(handleApiRequest, env, "editor", "editor123");
        assert.match(editorToken, /.+/);

        const deleteResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${createBody.user.id}`, {
                method: "DELETE",
            }),
            env
        );
        assert.strictEqual(deleteResponse.status, 200);
        assert.strictEqual(env.state.users.some((user) => user.username === "editor"), false);
    });

    test("Worker user management protects the last active admin", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({});
        await createLocalUser(handleApiRequest, env);
        const adminToken = await loginLocalUser(handleApiRequest, env, "admin", "password123");
        const adminId = env.state.users.find((user) => user.username === "admin").id;

        const disableResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${adminId}`, {
                method: "PUT",
                body: JSON.stringify({
                    username: "admin",
                    role: "admin",
                    active: false,
                }),
            }),
            env
        );
        const deleteResponse = await handleApiRequest(
            bearerRequest(adminToken, `https://example.com/api/users/${adminId}`, {
                method: "DELETE",
            }),
            env
        );

        assert.strictEqual(disableResponse.status, 400);
        assert.deepStrictEqual(await disableResponse.json(), { error: "Cannot remove the last active admin" });
        assert.strictEqual(deleteResponse.status, 400);
        assert.deepStrictEqual(await deleteResponse.json(), { error: "Cannot remove the last active admin" });
    });

    test("inactive Worker users cannot log in", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            users: [
                {
                    id: 9,
                    username: "inactive",
                    role: "admin",
                    active: 0,
                    password_json: JSON.stringify(await hashTestWorkerPassword("password123")),
                    totp_json: null,
                },
            ],
        });

        const response = await handleApiRequest(
            new Request("https://example.com/api/auth/login", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    username: "inactive",
                    password: "password123",
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 401);
        assert.deepStrictEqual(await response.json(), { error: "authIncorrectCreds" });
    });

    test("ADMIN_API_TOKEN keeps full system-admin fallback after local users exist", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            users: [
                {
                    id: 10,
                    username: "viewer",
                    role: "viewer",
                    active: 1,
                    password_json: JSON.stringify(await hashTestWorkerPassword("password123")),
                    totp_json: null,
                },
            ],
        });

        const response = await handleApiRequest(adminRequest("https://example.com/api/users"), env);
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.users.length, 1);
        assert.strictEqual(body.users[0].username, "viewer");
    });

    test("Worker status page API stays public while protected writes still require auth", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            users: [
                {
                    id: 11,
                    username: "admin",
                    role: "admin",
                    active: 1,
                    password_json: JSON.stringify(await hashTestWorkerPassword("password123")),
                    totp_json: null,
                },
            ],
            monitors: [
                {
                    id: 99,
                    name: "Public Site",
                    type: "http",
                    url: "https://public.example.test",
                    active: 1,
                },
            ],
            settings: {
                "statusPagePublicGroupList:default": [
                    {
                        name: "Public",
                        monitorList: [99],
                    },
                ],
            },
        });

        const readResponse = await handleApiRequest(new Request("https://example.com/api/status-page/default"), env);
        const writeResponse = await handleApiRequest(
            new Request("https://example.com/api/status-page/default", {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ publicGroupList: [] }),
            }),
            env
        );

        assert.strictEqual(readResponse.status, 200);
        assert.strictEqual((await readResponse.json()).publicGroupList.length, 1);
        assert.strictEqual(writeResponse.status, 401);
        assert.deepStrictEqual(await writeResponse.json(), { error: "Unauthorized" });
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
        const body = await response.json();
        assert.strictEqual(body.authenticated, true);
        assert.strictEqual(body.username, "admin");
        assert.strictEqual(body.user.username, "admin");
        assert.strictEqual(body.role, "admin");
        assert.ok(body.permissions.includes("users.read"));
        assert.strictEqual(body.localAuthConfigured, true);
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

        assert.ok(
            env.state.queries.some((sql) => sql.includes("FROM monitor_event_log")),
            "aggregate event log should read the derived event table"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("COUNT(*) AS total_count") && sql.includes("monitor_event_log")),
            "aggregate event log should return the total count with the requested page"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("LAG(status) OVER")),
            "aggregate event log should not classify transitions from raw heartbeats on the read path"
        );
    });

    test("important heartbeat endpoints read seeded derived event-log rows without raw history fallback", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorEventLog: [
                {
                    id: 1,
                    heartbeat_id: 101,
                    monitor_id: 7,
                    status: 0,
                    ping: null,
                    msg: "primary down",
                    checked_at: "2026-05-12 04:02:00",
                },
                {
                    id: 2,
                    heartbeat_id: 102,
                    monitor_id: 7,
                    status: 1,
                    ping: 10,
                    msg: "primary recovered",
                    checked_at: "2026-05-12 04:03:00",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/heartbeats?important=1&offset=0&count=20"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.count, 2);
        assert.deepStrictEqual(
            body.heartbeats.map((heartbeat) => heartbeat.msg),
            ["primary recovered", "primary down"]
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("FROM monitor_event_log")),
            "important heartbeat page should read the derived event log"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("FROM heartbeats")),
            "seeded event-log pages should not fall back to raw heartbeat history"
        );
    });

    test("empty important heartbeat pages do not backfill raw history once summaries exist", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: 101,
                    status: 1,
                    ping: 10,
                    msg: "up",
                    checked_at: "2026-05-12 04:03:00",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/heartbeats?important=1&offset=0&count=20"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { count: 0, heartbeats: [] });
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("ORDER BY checked_at ASC")),
            "empty event-log pages with summaries should not rebuild raw heartbeat history"
        );
    });

    test("monitor chart endpoint reads bucketed metrics instead of raw heartbeats", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const bucketStart = new Date().toISOString().slice(0, 19).replace("T", " ");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: bucketStart,
                    up_count: 2,
                    down_count: 1,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 3,
                    ping_sum: 40,
                    min_ping: 15,
                    max_ping: 25,
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/chart?period=24"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].up, 2);
        assert.strictEqual(body.data[0].down, 1);
        assert.strictEqual(body.data[0].avgPing, 20);
        assert.strictEqual(body.data[0].minPing, 15);
        assert.strictEqual(body.data[0].maxPing, 25);
        assert.ok(
            env.state.queries.some((sql) => sql.includes("FROM monitor_metric_bucket")),
            "chart endpoint should read metric buckets"
        );
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("FROM heartbeats")),
            "seeded chart buckets should avoid raw heartbeat paging"
        );
    });

    test("168-hour chart falls back to read-only hourly aggregation from 60-second buckets", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const bucketStart = new Date().toISOString().slice(0, 13).replace("T", " ") + ":00:00";
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: bucketStart,
                    up_count: 3,
                    down_count: 1,
                    pending_count: 1,
                    maintenance_count: 0,
                    total_count: 5,
                    ping_sum: 90,
                    min_ping: 20,
                    max_ping: 40,
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/chart?period=168"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.strictEqual(body.data.length, 1);
        assert.strictEqual(body.data[0].up, 3);
        assert.strictEqual(body.data[0].down, 2);
        assert.strictEqual(body.data[0].avgPing, 30);
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 3600).length, 0);
        assert.ok(
            env.state.queries.some((sql) => sql.includes("resolution_seconds = 60") && sql.includes("GROUP BY monitor_id")),
            "168-hour chart should aggregate 60-second buckets without writing hourly buckets"
        );
    });

    test("chart endpoint accepts 30-minute and 1-month dashboard periods", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const recentBucketStart = new Date().toISOString().slice(0, 16).replace("T", " ") + ":00";
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: recentBucketStart,
                    up_count: 1,
                    down_count: 0,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 1,
                    ping_sum: 12,
                    min_ping: 12,
                    max_ping: 12,
                },
            ],
        });

        const thirtyMinuteResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/chart?period=0.5"),
            env
        );
        const thirtyMinuteBody = await thirtyMinuteResponse.json();
        const thirtyMinuteBucketStatement = env.state.boundStatements.find((statement) =>
            statement.sql.includes("FROM monitor_metric_bucket") &&
            Number(statement.values[1]) === 60
        );

        assert.strictEqual(thirtyMinuteResponse.status, 200);
        assert.strictEqual(thirtyMinuteBody.data.length, 1);
        assert.ok(thirtyMinuteBucketStatement, "30-minute chart should query 60-second metric buckets");
        assert.ok(
            Date.now() - Date.parse(`${thirtyMinuteBucketStatement.values[2]}Z`) < 45 * 60 * 1000,
            "30-minute chart should not normalize to the 24-hour default"
        );

        const oneMonthResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/chart?period=720"),
            env
        );
        await oneMonthResponse.json();
        const oneMonthBucketStatement = env.state.boundStatements.find((statement) =>
            statement.sql.includes("FROM monitor_metric_bucket") &&
            Number(statement.values[1]) === 3600
        );

        assert.strictEqual(oneMonthResponse.status, 200);
        assert.ok(oneMonthBucketStatement, "1-month chart should query hourly metric buckets");
    });

    test("empty chart pages do not backfill raw history once summaries exist", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 7, name: "Primary WAN", type: "ping", active: 1 },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: null,
                    status: null,
                    ping: null,
                    msg: "",
                    checked_at: null,
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/chart?period=24"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { ok: true, data: [] });
        assert.ok(
            env.state.queries.every((sql) => !sql.includes("ORDER BY checked_at ASC")),
            "empty chart pages with summaries should not rebuild raw heartbeat history"
        );
    });

    test("heartbeatless group chart backfill stores nullable summary values", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                { id: 172, name: "Endpoints", type: "group", active: 1, parent: null },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/172/chart?period=3"),
            env
        );
        const body = await response.json();

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(body, { ok: true, data: [] });
        assert.strictEqual(env.state.monitorRuntimeSummaries.length, 1);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].monitor_id, 172);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].uptime_24, null);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].uptime_720, null);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].uptime_1y, null);

        const bootstrapResponse = await handleApiRequest(
            adminRequest("https://example.com/api/dashboard/bootstrap"),
            env
        );
        const bootstrapBody = await bootstrapResponse.json();

        assert.strictEqual(bootstrapResponse.status, 200);
        assert.strictEqual(bootstrapBody.uptimeList["172_24"], undefined);
        assert.strictEqual(bootstrapBody.uptimeList["172_720"], undefined);
        assert.strictEqual(bootstrapBody.uptimeList["172_1y"], undefined);
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

    test("clears a Twingate network route when a full monitor edit chooses direct", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 42,
                    name: "Public HTTP",
                    type: "http",
                    url: "https://example.com",
                    method: "GET",
                    timeout: 30,
                    interval: 60,
                    active: 1,
                    network_profile_id: "twingate",
                },
            ],
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/42", {
                method: "PUT",
                body: JSON.stringify({
                    id: 42,
                    name: "Public HTTP",
                    type: "http",
                    url: "https://example.com",
                    method: "GET",
                    timeout: 30,
                    interval: 60,
                    active: true,
                    networkProfileId: null,
                }),
            }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(env.state.monitors[0].network_profile_id, null);
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
                    config_json: JSON.stringify({ ignoreTls: true }),
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
        assert.strictEqual(env.state.runnerJobs[0].monitor.ignoreTls, true);
        assert.deepStrictEqual(env.state.heartbeats[0], {
            monitor_id: 7,
            status: 1,
            ping: 12,
            msg: "200 - OK",
        });
    });

    test("check-now sends legacy ignore_tls state to the runner", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            profiles: [
                { id: "twingate", slug: "twingate", name: "Twingate", type: "twingate", enabled: 1 },
            ],
            monitors: [
                {
                    id: 17,
                    name: "Legacy Self Signed HTTP",
                    type: "http",
                    url: "https://192.168.50.1",
                    hostname: null,
                    port: null,
                    timeout: 5,
                    network_profile_id: "twingate",
                    ignore_tls: 1,
                    config_json: JSON.stringify({}),
                },
            ],
            runnerResult: { status: 1, ping: 12, msg: "200 - OK", response: "ok" },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/17/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.strictEqual(env.state.runnerJobs.length, 1);
        assert.strictEqual(env.state.runnerJobs[0].monitor.ignoreTls, true);
    });

    test("heartbeat writes update dashboard summary, event, and 60-second metric bucket tables", async () => {
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
                    active: 1,
                    network_profile_id: "twingate",
                },
            ],
            runnerResults: [
                { status: 1, ping: 12, msg: "200 - OK", response: "ok" },
                { status: 0, ping: null, msg: "Timeout", response: null },
            ],
        });

        const firstResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const secondResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(firstResponse.status, 200);
        assert.strictEqual(secondResponse.status, 200);
        assert.strictEqual(env.state.heartbeats.length, 2);
        assert.strictEqual(env.state.monitorRuntimeSummaries.length, 1);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].monitor_id, 7);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].status, 0);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].msg, "Timeout");
        assert.deepStrictEqual(
            env.state.monitorEventLog.map((event) => [event.monitor_id, event.status, event.msg]),
            [[7, 0, "Timeout"]]
        );
        assert.deepStrictEqual(
            [...new Set(env.state.monitorMetricBuckets.map((bucket) => bucket.resolution_seconds))].sort((a, b) => a - b),
            [60]
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("INSERT INTO monitor_runtime_summary")),
            "heartbeat write should update the runtime summary"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("INSERT INTO monitor_event_log")),
            "heartbeat write should update the event log for transitions"
        );
        assert.ok(
            env.state.queries.some((sql) => sql.includes("INSERT INTO monitor_metric_bucket")),
            "heartbeat write should update metric buckets"
        );
    });

    test("stable UP checks sample raw heartbeats while metric buckets count every check", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Sampled HTTP",
                    type: "http",
                    url: "https://sampled.example.test",
                    active: 1,
                    network_profile_id: null,
                },
            ],
            runnerResults: [
                { status: 1, ping: 20, msg: "200 - OK", response: null },
                { status: 1, ping: 21, msg: "200 - OK", response: null },
            ],
        });

        const firstResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const secondResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(firstResponse.status, 200);
        assert.strictEqual(secondResponse.status, 200);
        assert.strictEqual(env.state.heartbeats.length, 1);
        assert.strictEqual(env.state.heartbeats[0].msg, "200 - OK");
        assert.strictEqual(env.state.monitorRuntimeSummaries.length, 1);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].status, 1);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].ping, 21);
        assert.strictEqual(env.state.monitorRuntimeSummaries[0].msg, "200 - OK");
        assert.deepStrictEqual(
            env.state.monitorMetricBuckets.map((bucket) => [bucket.resolution_seconds, bucket.total_count]),
            [[60, 2]]
        );
    });

    test("DOWN and recovery checks are always persisted despite OK sampling", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Flapping HTTP",
                    type: "http",
                    url: "https://flap.example.test",
                    active: 1,
                    network_profile_id: null,
                    config_json: JSON.stringify({ maxretries: 0 }),
                },
            ],
            heartbeats: [
                {
                    id: 100,
                    monitor_id: 7,
                    status: 1,
                    ping: 15,
                    msg: "200 - OK",
                    checked_at: "2026-05-18 14:00:00",
                },
            ],
            runnerResults: [
                { status: 0, ping: null, msg: "Timeout", response: null },
                { status: 1, ping: 18, msg: "200 - OK", response: null },
            ],
        });

        const downResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );
        const recoveryResponse = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(downResponse.status, 200);
        assert.strictEqual(recoveryResponse.status, 200);
        assert.deepStrictEqual(
            env.state.heartbeats.map((heartbeat) => heartbeat.status),
            [1, 0, 1]
        );
        assert.deepStrictEqual(
            env.state.heartbeats.map((heartbeat) => heartbeat.msg),
            ["200 - OK", "Timeout", "200 - OK"]
        );
    });

    test("hot-path metric writes only update 60-second buckets", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Metric HTTP",
                    type: "http",
                    url: "https://metric.example.test",
                    active: 1,
                    network_profile_id: null,
                },
            ],
            runnerResult: { status: 1, ping: 20, msg: "200 - OK", response: null },
        });

        const response = await handleApiRequest(
            adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
            env
        );

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(
            [...new Set(env.state.monitorMetricBuckets.map((bucket) => bucket.resolution_seconds))],
            [60]
        );
    });

    test("D1 usage debug logs rows read and written from query metadata", async () => {
        const { handleApiRequest } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitors: [
                {
                    id: 7,
                    name: "Debug HTTP",
                    type: "http",
                    url: "https://debug.example.test",
                    active: 1,
                    network_profile_id: null,
                },
            ],
            runnerResult: { status: 1, ping: 20, msg: "200 - OK", response: null },
        });
        env.D1_USAGE_DEBUG = "1";
        const originalLog = console.log;
        const logs = [];
        console.log = (...args) => {
            logs.push(args.join(" "));
        };

        try {
            const response = await handleApiRequest(
                adminRequest("https://example.com/api/monitors/7/check-now", { method: "POST" }),
                env
            );
            assert.strictEqual(response.status, 200);
        } finally {
            console.log = originalLog;
        }

        assert.ok(logs.some((line) => line.includes('"type":"d1_usage"')));
        assert.ok(logs.some((line) => line.includes('"rows_written":')));
        assert.ok(logs.some((line) => line.includes('"rows_read":')));
    });

    test("scheduled metric rollups rebuild hourly and daily buckets idempotently from 60-second buckets", async () => {
        const { rollupDashboardMetricBuckets } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: "2026-05-18 14:00:00",
                    up_count: 1,
                    down_count: 0,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 1,
                    ping_sum: 20,
                    min_ping: 20,
                    max_ping: 20,
                },
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: "2026-05-18 14:01:00",
                    up_count: 0,
                    down_count: 1,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 1,
                    ping_sum: 0,
                    min_ping: null,
                    max_ping: null,
                },
            ],
        });

        const firstResult = await rollupDashboardMetricBuckets(env, { resolutions: [3600, 86400] });
        const secondResult = await rollupDashboardMetricBuckets(env, { resolutions: [3600, 86400] });

        assert.deepStrictEqual(firstResult, { rolledUp: 2 });
        assert.deepStrictEqual(secondResult, { rolledUp: 2 });
        const hourly = env.state.monitorMetricBuckets.find((bucket) => bucket.resolution_seconds === 3600);
        const daily = env.state.monitorMetricBuckets.find((bucket) => bucket.resolution_seconds === 86400);
        assert.deepStrictEqual(
            pick(hourly, ["monitor_id", "bucket_start", "up_count", "down_count", "total_count", "ping_sum", "min_ping", "max_ping"]),
            {
                monitor_id: 7,
                bucket_start: "2026-05-18 14:00:00",
                up_count: 1,
                down_count: 1,
                total_count: 2,
                ping_sum: 20,
                min_ping: 20,
                max_ping: 20,
            }
        );
        assert.deepStrictEqual(
            pick(daily, ["monitor_id", "bucket_start", "up_count", "down_count", "total_count", "ping_sum", "min_ping", "max_ping"]),
            {
                monitor_id: 7,
                bucket_start: "2026-05-18 00:00:00",
                up_count: 1,
                down_count: 1,
                total_count: 2,
                ping_sum: 20,
                min_ping: 20,
                max_ping: 20,
            }
        );
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 3600).length, 1);
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 86400).length, 1);
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
        const retryQuery = env.state.boundStatements.find(({ sql }) => sql.includes("SELECT status FROM heartbeats"));
        assert.ok(retryQuery);
        assert.match(retryQuery.sql, /LIMIT \?/);
        assert.deepStrictEqual(retryQuery.values, [7, 3]);
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

    test("new Worker versions resume scheduled checks immediately when Twingate is already running", async () => {
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
            runnerStatus: {
                configured: true,
                starting: false,
                running: true,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "off",
                lastError: null,
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
        assert.strictEqual(env.state.settings.deployMonitorPause.versionId, "version-a");
        assert.ok(Date.parse(env.state.settings.deployMonitorPause.pauseUntil) <= Date.now());
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

    test("existing Worker versions resume scheduled checks once Twingate is running", async () => {
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
            runnerStatus: {
                configured: true,
                starting: false,
                running: true,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "off",
                lastError: null,
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
        assert.strictEqual(env.state.settings.deployMonitorPause.versionId, "version-a");
        assert.ok(Date.parse(env.state.settings.deployMonitorPause.pauseUntil) <= Date.now());
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

    test("caches the unpaused deploy state to skip settings reads on later checks", async () => {
        const { getDeployMonitorPauseState } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                deployMonitorPause: {
                    versionId: "version-a",
                    pauseUntil: new Date(Date.now() - 60_000).toISOString(),
                },
            },
            workerVersionId: "version-a",
            deployMonitorPauseSeconds: "120",
        });

        const first = await getDeployMonitorPauseState(env);
        assert.strictEqual(first.paused, false);

        const queriesAfterFirstCall = env.state.queries.length;
        const second = await getDeployMonitorPauseState(env);

        assert.strictEqual(second.paused, false);
        assert.strictEqual(second.versionId, "version-a");
        assert.strictEqual(env.state.queries.length, queriesAfterFirstCall);
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
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    status: 1,
                    checked_at: new Date(now - 60_000).toISOString(),
                },
                {
                    monitor_id: 8,
                    status: 1,
                    checked_at: new Date(now - 61_000).toISOString(),
                },
            ],
        });

        const result = await enqueueDueMonitors(env, new Date(now));

        assert.strictEqual(result.paused, false);
        assert.strictEqual(result.enqueued, 2);
        assert.deepStrictEqual(env.MONITOR_QUEUE.sent.map((message) => message.monitorId), [8, 9]);
        const dueQuery = env.state.queries.find((sql) => sql.includes("FROM monitors") && sql.includes("monitor_runtime_summary"));
        assert.ok(dueQuery);
        assert.doesNotMatch(dueQuery, /FROM heartbeats/);
    });

    test("scheduled maintenance cadence gates backfill, purge, rollups, and Twingate checks", async () => {
        const { runScheduledMaintenance } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                keepDataPeriodDays: 7,
                twingateAlertEnabled: true,
                twingateAlertNotificationIDList: { 3: true },
                twingateAlertThresholdMinutes: 5,
            },
            monitors: [
                {
                    id: 7,
                    name: "Cadence HTTP",
                    type: "http",
                    url: "https://cadence.example.test",
                    interval: 60,
                    active: 1,
                },
            ],
            heartbeats: [
                {
                    id: 1,
                    monitor_id: 7,
                    status: 1,
                    ping: 20,
                    msg: "old",
                    checked_at: "2026-05-18 11:00:00",
                },
            ],
            monitorRuntimeSummaries: [
                {
                    monitor_id: 7,
                    latest_heartbeat_id: 1,
                    status: 1,
                    ping: 20,
                    msg: "old",
                    checked_at: "2026-05-18 11:00:00",
                },
            ],
            monitorMetricBuckets: [
                {
                    monitor_id: 7,
                    resolution_seconds: 60,
                    bucket_start: "2026-05-18 11:00:00",
                    up_count: 1,
                    down_count: 0,
                    pending_count: 0,
                    maintenance_count: 0,
                    total_count: 1,
                    ping_sum: 20,
                    min_ping: 20,
                    max_ping: 20,
                },
            ],
            runnerStatus: {
                configured: true,
                starting: false,
                running: true,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "on",
                lastError: null,
            },
        });

        const quietResult = await runScheduledMaintenance(
            { scheduledTime: Date.parse("2026-05-18T12:01:00Z") },
            env
        );
        assert.strictEqual(quietResult.enqueued, 1);
        assert.strictEqual(quietResult.backfill, null);
        assert.strictEqual(quietResult.purge, null);
        assert.strictEqual(quietResult.twingate, null);
        assert.strictEqual(quietResult.rollupHourly, null);
        assert.strictEqual(quietResult.rollupDaily, null);
        assert.strictEqual(env.state.runnerStatusRequests, 0);
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 3600).length, 0);

        const fiveMinuteResult = await runScheduledMaintenance(
            { scheduledTime: Date.parse("2026-05-18T12:05:00Z") },
            env
        );
        assert.ok(fiveMinuteResult.twingate);
        assert.strictEqual(env.state.runnerStatusRequests, 1);

        const fifteenMinuteResult = await runScheduledMaintenance(
            { scheduledTime: Date.parse("2026-05-18T12:15:00Z") },
            env
        );
        assert.ok(fifteenMinuteResult.backfill);
        assert.ok(fifteenMinuteResult.rollupHourly);
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 3600).length, 1);

        const dailyResult = await runScheduledMaintenance(
            { scheduledTime: Date.parse("2026-05-19T00:00:00Z") },
            env
        );
        assert.ok(dailyResult.purge);
        assert.ok(dailyResult.rollupDaily);
        assert.strictEqual(env.state.monitorMetricBuckets.filter((bucket) => bucket.resolution_seconds === 86400).length, 1);
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

    test("Twingate health alert skips rewriting an unchanged steady-state alert state", async () => {
        const { checkTwingateHealthAlert } = await import("../../../cloudflare/worker/api.mjs");
        const env = createEnv({
            settings: {
                twingateAlertEnabled: true,
                twingateAlertNotificationIDList: {
                    4: true,
                },
                twingateAlertState: {
                    firstDegradedAt: null,
                    lastStatusAt: "2026-05-27T11:55:00.000Z",
                    lastError: null,
                    notifiedStatus: "healthy",
                    lastNotificationAt: "2026-05-27T11:00:00.000Z",
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

        const result = await checkTwingateHealthAlert(env, new Date("2026-05-27T12:00:00Z"));

        assert.strictEqual(result.degraded, false);
        assert.strictEqual(result.notified, false);
        // The stored state is untouched, so the steady-state cron run performs no D1 write.
        assert.strictEqual(env.state.settings.twingateAlertState.lastStatusAt, "2026-05-27T11:55:00.000Z");
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
    const initialHeartbeats = normalizeInitialHeartbeats(initial.heartbeats || []);
    const state = {
        now: initial.now,
        profiles: initial.profiles || [],
        monitors: initial.monitors || [],
        heartbeats: initialHeartbeats,
        monitorRuntimeSummaries: initial.monitorRuntimeSummaries || [],
        monitorEventLog: initial.monitorEventLog || [],
        monitorMetricBuckets: initial.monitorMetricBuckets || [],
        notifications: initial.notifications || [],
        monitorNotifications: initial.monitorNotifications || [],
        tags: initial.tags || [],
        monitorTags: initial.monitorTags || [],
        proxies: initial.proxies || [],
        dockerHosts: initial.dockerHosts || [],
        remoteBrowsers: initial.remoteBrowsers || [],
        users: initial.users || [],
        userSessions: initial.userSessions || [],
        userAuditLog: initial.userAuditLog || [],
        settings: initial.settings || {},
        queries: [],
        boundStatements: [],
        runnerJobs: [],
        runnerStatusRequests: 0,
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
        nextHeartbeatId: initial.nextHeartbeatId || nextHeartbeatIdAfter(initialHeartbeats),
        nextMonitorEventLogId: initial.nextMonitorEventLogId || 1,
        nextNotificationId: initial.nextNotificationId || 1,
        nextTagId: initial.nextTagId || 1,
        nextMonitorTagId: initial.nextMonitorTagId || 1,
        nextProxyId: initial.nextProxyId || 1,
        nextDockerHostId: initial.nextDockerHostId || 1,
        nextRemoteBrowserId: initial.nextRemoteBrowserId || 1,
        nextUserId: initial.nextUserId || nextUserIdAfter(initial.users || []),
        nextUserAuditLogId: initial.nextUserAuditLogId || 1,
        missingConfigJsonColumn: Boolean(initial.missingConfigJsonColumn),
        missingParentColumn: Boolean(initial.missingParentColumn),
        missingProxyColumn: Boolean(initial.missingProxyColumn),
        missingNotificationTables: Boolean(initial.missingNotificationTables),
        missingTagTables: Boolean(initial.missingTagTables),
        missingDashboardRuntimeCacheTables: Boolean(initial.missingDashboardRuntimeCacheTables),
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
            async batch(statements) {
                const results = [];
                for (const statement of statements) {
                    results.push(await statement.run());
                }
                return results;
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
                            state.runnerStatusRequests++;
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

function normalizeInitialHeartbeats(heartbeats) {
    return heartbeats.map((heartbeat, index) => {
        const row = { ...heartbeat };
        if (row.id == null) {
            Object.defineProperty(row, "id", {
                value: index + 1,
            });
        }
        return row;
    });
}

function nextHeartbeatIdAfter(heartbeats) {
    const maxId = heartbeats.reduce((max, heartbeat) => Math.max(max, Number(heartbeat.id || 0)), 0);
    return maxId + 1;
}

function nextUserIdAfter(users) {
    const maxId = users.reduce((max, user) => Math.max(max, Number(user.id || 0)), 0);
    return maxId + 1;
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
 * Create an authenticated Worker API request with a local user token.
 * @param {string} token Local user session token.
 * @param {string} url Request URL.
 * @param {RequestInit} init Request init.
 * @returns {Request} Authenticated request.
 */
function bearerRequest(token, url, init = {}) {
    return new Request(url, {
        ...init,
        headers: {
            "content-type": "application/json",
            ...(init.headers || {}),
            authorization: `Bearer ${token}`,
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
 * Log in with a local Worker user and return the session token.
 * @param {(request: Request, env: object) => Promise<Response>} handleApiRequest Worker API handler.
 * @param {object} env Test Worker environment.
 * @param {string} username Username.
 * @param {string} password Password.
 * @returns {Promise<string>} Session token.
 */
async function loginLocalUser(handleApiRequest, env, username, password) {
    const response = await handleApiRequest(
        new Request("https://example.com/api/auth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password }),
        }),
        env
    );
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.match(body.token, /.+/);
    return body.token;
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
            const unsupportedIndex = values.findIndex((value) => value === undefined);
            if (unsupportedIndex !== -1) {
                throw new Error(
                    `D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined' at binding ${
                        unsupportedIndex + 1
                    }`
                );
            }
            this.values = values;
            state.boundStatements.push({
                sql,
                values: [...values],
            });
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
            if (sql.includes("FROM users")) {
                let results = state.users.map((user) => ({ ...user }));
                if (sql.includes("ORDER BY id") && sql.includes("LIMIT 2")) {
                    results = results
                        .toSorted((a, b) => Number(a.id) - Number(b.id))
                        .slice(0, 2);
                } else {
                    results.sort((a, b) => String(a.username).localeCompare(String(b.username)));
                }
                return { results };
            }
            if (sql.includes("FROM monitor_runtime_summary")) {
                if (state.missingDashboardRuntimeCacheTables) {
                    throw new Error("D1_ERROR: no such table: monitor_runtime_summary: SQLITE_ERROR");
                }
                let results = [...state.monitorRuntimeSummaries];
                if (sql.includes("WHERE monitor_id IN")) {
                    const ids = this.values.map(Number);
                    results = results.filter((summary) => ids.includes(Number(summary.monitor_id)));
                } else if (sql.includes("WHERE monitor_id = ?")) {
                    results = results.filter((summary) => Number(summary.monitor_id) === Number(this.values[0]));
                }
                return { results };
            }
            if (sql.includes("FROM monitor_event_log")) {
                if (state.missingDashboardRuntimeCacheTables) {
                    throw new Error("D1_ERROR: no such table: monitor_event_log: SQLITE_ERROR");
                }
                return { results: buildMonitorEventLogQueryResults(this.values, state) };
            }
            if (sql.includes("FROM monitor_metric_bucket") && sql.includes("GROUP BY monitor_id")) {
                if (state.missingDashboardRuntimeCacheTables) {
                    throw new Error("D1_ERROR: no such table: monitor_metric_bucket: SQLITE_ERROR");
                }
                return { results: buildMetricRollupRows(sql, this.values, state) };
            }
            if (sql.includes("FROM monitor_metric_bucket")) {
                if (state.missingDashboardRuntimeCacheTables) {
                    throw new Error("D1_ERROR: no such table: monitor_metric_bucket: SQLITE_ERROR");
                }
                const [monitorId, resolutionSeconds, since] = this.values;
                const results = state.monitorMetricBuckets
                    .filter((bucket) =>
                        Number(bucket.monitor_id) === Number(monitorId) &&
                        Number(bucket.resolution_seconds) === Number(resolutionSeconds) &&
                        String(bucket.bucket_start) >= String(since)
                    )
                    .toSorted((a, b) => String(a.bucket_start).localeCompare(String(b.bucket_start)));
                return { results };
            }
            if (sql.includes("ROW_NUMBER() OVER") && sql.includes("ranked_heartbeats")) {
                const limit = Number(this.values.at(-1));
                const ids = this.values.slice(0, -1).map(Number);
                const results = [];
                for (const id of ids) {
                    const recentHeartbeats = state.heartbeats
                        .filter((heartbeat) => Number(heartbeat.monitor_id) === id)
                        .toSorted((a, b) => {
                            const checkedAtCompare = String(b.checked_at).localeCompare(String(a.checked_at));
                            if (checkedAtCompare !== 0) {
                                return checkedAtCompare;
                            }
                            return Number(b.id || 0) - Number(a.id || 0);
                        })
                        .slice(0, limit)
                        .reverse();
                    results.push(...recentHeartbeats);
                }
                return { results };
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
            if (sql.includes("FROM monitors m") && sql.includes("monitor_runtime_summary")) {
                return { results: state.monitors.filter((monitor) => isMonitorDueForEnqueue(monitor, state, this.values[0])) };
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
                results.sort((a, b) => {
                    const checkedAtCompare = sql.includes("ORDER BY checked_at ASC")
                        ? String(a.checked_at).localeCompare(String(b.checked_at))
                        : String(b.checked_at).localeCompare(String(a.checked_at));
                    if (checkedAtCompare !== 0) {
                        return checkedAtCompare;
                    }
                    return sql.includes("ORDER BY checked_at ASC")
                        ? Number(a.id || 0) - Number(b.id || 0)
                        : Number(b.id || 0) - Number(a.id || 0);
                });
                if (sql.includes("LIMIT ?")) {
                    const hasOffset = sql.includes("OFFSET ?");
                    const limit = Number(hasOffset ? this.values.at(-2) : this.values.at(-1));
                    const offset = Number(hasOffset ? this.values.at(-1) : 0);
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
            if (sql.includes("COUNT(*) AS count") && sql.includes("FROM users")) {
                if (sql.includes("role = 'admin'")) {
                    const exceptUserId = Number(this.values[0]);
                    return {
                        count: state.users.filter(
                            (user) =>
                                user.role === "admin" &&
                                Number(user.active) === 1 &&
                                Number(user.id) !== exceptUserId
                        ).length,
                    };
                }
                return { count: state.users.length };
            }
            if (sql.includes("FROM user_sessions")) {
                const [sessionId, tokenHash] = this.values;
                return state.userSessions.find(
                    (session) => session.id === sessionId && session.token_hash === tokenHash
                ) || null;
            }
            if (sql.includes("FROM users")) {
                if (sql.includes("lower(username)")) {
                    const username = String(this.values[0] || "").toLowerCase();
                    return state.users.find((user) => String(user.username).toLowerCase() === username) || null;
                }
                if (sql.includes("WHERE id = ?")) {
                    const id = Number(this.values[0]);
                    return state.users.find((user) => Number(user.id) === id) || null;
                }
                return state.users[0] || null;
            }
            if (sql.includes("FROM monitor_metric_bucket")) {
                if (state.missingDashboardRuntimeCacheTables) {
                    throw new Error("D1_ERROR: no such table: monitor_metric_bucket: SQLITE_ERROR");
                }
                const [monitorId, resolutionSeconds, since] = this.values;
                const buckets = state.monitorMetricBuckets.filter((bucket) =>
                    Number(bucket.monitor_id) === Number(monitorId) &&
                    Number(bucket.resolution_seconds) === Number(resolutionSeconds) &&
                    String(bucket.bucket_start) >= String(since)
                );
                return {
                    up_count: buckets.reduce((total, bucket) => total + Number(bucket.up_count || 0), 0),
                    total_count: buckets.reduce((total, bucket) => total + Number(bucket.total_count || 0), 0),
                    ping_sum: buckets.reduce((total, bucket) => total + Number(bucket.ping_sum || 0), 0),
                };
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
            if (sql.includes("CREATE TABLE IF NOT EXISTS monitor_runtime_summary")) {
                state.missingDashboardRuntimeCacheTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS monitor_event_log")) {
                state.missingDashboardRuntimeCacheTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_monitor_event_log_checked_at")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_monitor_event_log_monitor_checked_at")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS monitor_metric_bucket")) {
                state.missingDashboardRuntimeCacheTables = false;
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_monitor_metric_bucket_lookup")) {
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
            if (sql.includes("CREATE TABLE IF NOT EXISTS users")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_users_role_active")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS user_sessions")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_user_sessions")) {
                return { success: true };
            }
            if (sql.includes("CREATE TABLE IF NOT EXISTS user_audit_log")) {
                return { success: true };
            }
            if (sql.includes("CREATE INDEX IF NOT EXISTS idx_user_audit_log")) {
                return { success: true };
            }
            if (sql.includes("INSERT INTO monitor_runtime_summary")) {
                const isFullRefresh = sql.includes("avg_ping");
                const [monitorId, latestHeartbeatId, status, ping, msg, checkedAt] = this.values;
                const existing = state.monitorRuntimeSummaries.find(
                    (summary) => Number(summary.monitor_id) === Number(monitorId)
                );
                const nextSummary = {
                    ...(existing || {}),
                    monitor_id: Number(monitorId),
                    latest_heartbeat_id: latestHeartbeatId == null ? null : Number(latestHeartbeatId),
                    status,
                    ping,
                    msg,
                    checked_at: checkedAt,
                };
                if (isFullRefresh) {
                    const [
                        ,
                        ,
                        ,
                        ,
                        ,
                        ,
                        avgPing,
                        uptime24,
                        uptime720,
                        uptime1y,
                        heartbeatBarJson,
                    ] = this.values;
                    Object.assign(nextSummary, {
                        avg_ping: avgPing,
                        uptime_24: uptime24,
                        uptime_720: uptime720,
                        uptime_1y: uptime1y,
                        heartbeat_bar_json: heartbeatBarJson,
                    });
                }
                upsertByKey(state.monitorRuntimeSummaries, "monitor_id", Number(monitorId), nextSummary);
                return { success: true };
            }
            if (sql.includes("INSERT INTO monitor_event_log")) {
                const [heartbeatId, monitorId, status, ping, msg, checkedAt] = this.values;
                const existing = state.monitorEventLog.find((event) => Number(event.heartbeat_id) === Number(heartbeatId));
                const event = {
                    id: existing?.id || state.nextMonitorEventLogId++,
                    heartbeat_id: Number(heartbeatId),
                    monitor_id: Number(monitorId),
                    status,
                    ping,
                    msg,
                    checked_at: checkedAt,
                };
                if (existing) {
                    Object.assign(existing, event);
                } else {
                    state.monitorEventLog.push(event);
                }
                return { success: true };
            }
            if (sql.includes("INSERT INTO monitor_metric_bucket")) {
                if (sql.includes("total_count = excluded.total_count")) {
                    const [
                        monitorId,
                        resolutionSeconds,
                        bucketStart,
                        upCount,
                        downCount,
                        pendingCount,
                        maintenanceCount,
                        totalCount,
                        pingSum,
                        minPing,
                        maxPing,
                    ] = this.values;
                    upsertMetricBucketExact(state, {
                        monitor_id: Number(monitorId),
                        resolution_seconds: Number(resolutionSeconds),
                        bucket_start: bucketStart,
                        up_count: Number(upCount || 0),
                        down_count: Number(downCount || 0),
                        pending_count: Number(pendingCount || 0),
                        maintenance_count: Number(maintenanceCount || 0),
                        total_count: Number(totalCount || 0),
                        ping_sum: Number(pingSum || 0),
                        min_ping: minPing,
                        max_ping: maxPing,
                    });
                    return { success: true };
                }
                const [
                    monitorId,
                    resolutionSeconds,
                    bucketStart,
                    upCount,
                    downCount,
                    pendingCount,
                    maintenanceCount,
                    pingSum,
                    minPing,
                    maxPing,
                ] = this.values;
                const existing = state.monitorMetricBuckets.find((bucket) =>
                    Number(bucket.monitor_id) === Number(monitorId) &&
                    Number(bucket.resolution_seconds) === Number(resolutionSeconds) &&
                    bucket.bucket_start === bucketStart
                );
                if (existing) {
                    existing.up_count += Number(upCount || 0);
                    existing.down_count += Number(downCount || 0);
                    existing.pending_count += Number(pendingCount || 0);
                    existing.maintenance_count += Number(maintenanceCount || 0);
                    existing.total_count += 1;
                    existing.ping_sum += Number(pingSum || 0);
                    existing.min_ping = minPing == null
                        ? existing.min_ping
                        : existing.min_ping == null
                            ? minPing
                            : Math.min(Number(existing.min_ping), Number(minPing));
                    existing.max_ping = maxPing == null
                        ? existing.max_ping
                        : existing.max_ping == null
                            ? maxPing
                            : Math.max(Number(existing.max_ping), Number(maxPing));
                } else {
                    state.monitorMetricBuckets.push({
                        monitor_id: Number(monitorId),
                        resolution_seconds: Number(resolutionSeconds),
                        bucket_start: bucketStart,
                        up_count: Number(upCount || 0),
                        down_count: Number(downCount || 0),
                        pending_count: Number(pendingCount || 0),
                        maintenance_count: Number(maintenanceCount || 0),
                        total_count: 1,
                        ping_sum: Number(pingSum || 0),
                        min_ping: minPing,
                        max_ping: maxPing,
                    });
                }
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
            if (sql.includes("INSERT INTO users")) {
                const id = state.nextUserId++;
                let row;
                if (sql.includes("'admin'") && sql.includes("totp_json")) {
                    const [username, passwordJson, totpJson] = this.values;
                    row = {
                        id,
                        username,
                        display_name: null,
                        role: "admin",
                        password_json: passwordJson,
                        totp_json: totpJson ?? null,
                        active: 1,
                    };
                } else if (sql.includes("'admin'")) {
                    const [username, passwordJson] = this.values;
                    row = {
                        id,
                        username,
                        display_name: null,
                        role: "admin",
                        password_json: passwordJson,
                        totp_json: null,
                        active: 1,
                    };
                } else {
                    const [username, displayName, role, passwordJson, active] = this.values;
                    row = {
                        id,
                        username,
                        display_name: displayName,
                        role,
                        password_json: passwordJson,
                        totp_json: null,
                        active,
                    };
                }
                row.created_at = row.created_at || "2026-01-01 00:00:00";
                row.updated_at = row.updated_at || "2026-01-01 00:00:00";
                row.last_login_at = row.last_login_at || null;
                state.users.push(row);
                return { success: true, meta: { last_row_id: id } };
            }
            if (sql.includes("INSERT INTO user_sessions")) {
                const [id, userId, tokenHash, expiresAt] = this.values;
                state.userSessions.push({
                    id,
                    user_id: Number(userId),
                    token_hash: tokenHash,
                    expires_at: expiresAt,
                    revoked_at: null,
                    created_at: "2026-01-01 00:00:00",
                    last_seen_at: null,
                });
                return { success: true };
            }
            if (sql.includes("INSERT INTO user_audit_log")) {
                const [actorUserId, userId, action, detailsJson] = this.values;
                state.userAuditLog.push({
                    id: state.nextUserAuditLogId++,
                    actor_user_id: actorUserId,
                    user_id: userId,
                    action,
                    details_json: detailsJson,
                    created_at: "2026-01-01 00:00:00",
                });
                return { success: true };
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
            if (sql.includes("UPDATE users")) {
                if (sql.includes("SET last_login_at")) {
                    const [id] = this.values;
                    const user = state.users.find((candidate) => Number(candidate.id) === Number(id));
                    if (user) {
                        user.last_login_at = "2026-01-01 00:00:00";
                    }
                    return { success: true };
                }
                if (sql.includes("SET totp_json")) {
                    const [totpJson, id] = this.values;
                    const user = state.users.find((candidate) => Number(candidate.id) === Number(id));
                    if (user) {
                        user.totp_json = totpJson;
                        user.updated_at = "2026-01-01 00:00:00";
                    }
                    return { success: true };
                }
                if (sql.includes("SET username = ?, password_json")) {
                    const [username, passwordJson, id] = this.values;
                    const user = state.users.find((candidate) => Number(candidate.id) === Number(id));
                    if (user) {
                        user.username = username;
                        user.password_json = passwordJson;
                        user.updated_at = "2026-01-01 00:00:00";
                    }
                    return { success: true };
                }
                if (sql.includes("SET password_json")) {
                    const [passwordJson, id] = this.values;
                    const user = state.users.find((candidate) => Number(candidate.id) === Number(id));
                    if (user) {
                        user.password_json = passwordJson;
                        user.updated_at = "2026-01-01 00:00:00";
                    }
                    return { success: true };
                }
                const [username, displayName, role, active, id] = this.values;
                const user = state.users.find((candidate) => Number(candidate.id) === Number(id));
                if (user) {
                    Object.assign(user, {
                        username,
                        display_name: displayName,
                        role,
                        active,
                        updated_at: "2026-01-01 00:00:00",
                    });
                }
                return { success: true };
            }
            if (sql.includes("UPDATE user_sessions")) {
                if (sql.includes("WHERE id = ?")) {
                    const [id] = this.values;
                    const session = state.userSessions.find((candidate) => candidate.id === id);
                    if (session) {
                        if (sql.includes("last_seen_at")) {
                            session.last_seen_at = "2026-01-01 00:00:00";
                        }
                        if (sql.includes("revoked_at")) {
                            session.revoked_at = "2026-01-01 00:00:00";
                        }
                    }
                    return { success: true };
                }
                if (sql.includes("WHERE user_id = ?")) {
                    const [userId] = this.values;
                    for (const session of state.userSessions) {
                        if (Number(session.user_id) === Number(userId) && !session.revoked_at) {
                            session.revoked_at = "2026-01-01 00:00:00";
                        }
                    }
                    return { success: true };
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
                if (/UPDATE monitors SET\s+network_profile_id = \?, updated_at/i.test(sql)) {
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
            if (sql.includes("DELETE FROM users")) {
                const id = Number(this.values[0]);
                state.users = state.users.filter((user) => Number(user.id) !== id);
                state.userSessions = state.userSessions.filter((session) => Number(session.user_id) !== id);
                return { success: true };
            }
            if (sql.includes("DELETE FROM monitor_runtime_summary")) {
                if (sql.includes("WHERE monitor_id = ?")) {
                    const monitorId = Number(this.values[0]);
                    state.monitorRuntimeSummaries = state.monitorRuntimeSummaries.filter(
                        (summary) => Number(summary.monitor_id) !== monitorId
                    );
                } else {
                    state.monitorRuntimeSummaries = [];
                }
                return { success: true };
            }
            if (sql.includes("DELETE FROM monitor_event_log")) {
                if (sql.includes("WHERE checked_at < ?")) {
                    const cutoff = this.values[0];
                    state.monitorEventLog = state.monitorEventLog.filter((event) => event.checked_at >= cutoff);
                } else if (sql.includes("WHERE heartbeat_id = ?")) {
                    const heartbeatId = Number(this.values[0]);
                    state.monitorEventLog = state.monitorEventLog.filter((event) => Number(event.heartbeat_id) !== heartbeatId);
                } else if (sql.includes("WHERE monitor_id = ?")) {
                    const monitorId = Number(this.values[0]);
                    state.monitorEventLog = state.monitorEventLog.filter((event) => Number(event.monitor_id) !== monitorId);
                } else {
                    state.monitorEventLog = [];
                }
                return { success: true };
            }
            if (sql.includes("DELETE FROM monitor_metric_bucket")) {
                if (sql.includes("WHERE bucket_start < ?")) {
                    const cutoff = this.values[0];
                    state.monitorMetricBuckets = state.monitorMetricBuckets.filter((bucket) => bucket.bucket_start >= cutoff);
                } else if (sql.includes("WHERE monitor_id = ?")) {
                    const monitorId = Number(this.values[0]);
                    state.monitorMetricBuckets = state.monitorMetricBuckets.filter(
                        (bucket) => Number(bucket.monitor_id) !== monitorId
                    );
                } else {
                    state.monitorMetricBuckets = [];
                }
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
                const [monitorId, status, ping, msg, responseR2Key, checkedAt] = this.values;
                const id = state.nextHeartbeatId++;
                const heartbeat = {
                    monitor_id: Number(monitorId),
                    status,
                    ping,
                    msg,
                };
                Object.defineProperties(heartbeat, {
                    id: {
                        value: id,
                    },
                    response_r2_key: {
                        value: responseR2Key,
                    },
                    checked_at: {
                        value: checkedAt || new Date(state.now || Date.now()).toISOString(),
                    },
                });
                state.heartbeats.push(heartbeat);
                return { success: true, meta: { last_row_id: id } };
            }
            return { success: true };
        },
    };
    return statement;
}

function isMonitorDueForEnqueue(monitor, state, nowValue = null) {
    if (Number(monitor.active) !== 1 || monitor.type === "group") {
        return false;
    }
    const latestCheck = nowValue == null
        ? latestHeartbeatForMonitor(state.heartbeats, monitor.id)
        : state.monitorRuntimeSummaries.find((summary) => Number(summary.monitor_id) === Number(monitor.id));
    if (!latestCheck?.checked_at) {
        return true;
    }
    const checkedAt = parseTestSqlTime(latestCheck.checked_at);
    if (!Number.isFinite(checkedAt)) {
        return true;
    }
    const intervalSeconds = Number(monitor.interval) > 0 ? Number(monitor.interval) : 60;
    const now = nowValue == null ? (state.now || Date.now()) : parseTestSqlTime(nowValue);
    return now - checkedAt >= intervalSeconds * 1000;
}

function parseTestSqlTime(value) {
    if (value instanceof Date) {
        return value.getTime();
    }
    const text = String(value || "");
    return Date.parse(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
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

function buildMonitorEventLogQueryResults(values, state) {
    const hasMonitorFilter = values.length === 4;
    const monitorId = hasMonitorFilter ? Number(values[0]) : null;
    const limit = Number(hasMonitorFilter ? values[1] : values[0]);
    const offset = Number(hasMonitorFilter ? values[2] : values[1]);
    const activeMonitorIds = new Set(
        state.monitors
            .filter((monitor) => Number(monitor.active) === 1)
            .map((monitor) => Number(monitor.id))
    );
    const events = state.monitorEventLog
        .filter((event) => activeMonitorIds.has(Number(event.monitor_id)))
        .filter((event) => monitorId == null || Number(event.monitor_id) === monitorId)
        .toSorted((a, b) => {
            const checkedAtCompare = String(b.checked_at).localeCompare(String(a.checked_at));
            if (checkedAtCompare !== 0) {
                return checkedAtCompare;
            }
            return Number(b.id || 0) - Number(a.id || 0);
        });
    return events.slice(offset, offset + limit).map((event) => ({
        total_count: events.length,
        id: event.id,
        heartbeat_id: event.heartbeat_id,
        monitor_id: event.monitor_id,
        status: event.status,
        ping: event.ping,
        msg: event.msg,
        checked_at: event.checked_at,
    }));
}

function buildMetricRollupRows(sql, values, state) {
    const resolutionSeconds = Number(values[0]);
    const since = String(values[1] || "0000-01-01 00:00:00");
    const monitorId = sql.includes("AND monitor_id = ?") ? Number(values[2]) : null;
    const rowsByKey = new Map();

    for (const bucket of state.monitorMetricBuckets) {
        if (Number(bucket.resolution_seconds) !== 60 || String(bucket.bucket_start) < since) {
            continue;
        }
        if (monitorId != null && Number(bucket.monitor_id) !== monitorId) {
            continue;
        }
        const bucketStart = formatTestBucketStart(bucket.bucket_start, resolutionSeconds);
        const key = `${bucket.monitor_id}:${resolutionSeconds}:${bucketStart}`;
        const row = rowsByKey.get(key) || {
            monitor_id: Number(bucket.monitor_id),
            resolution_seconds: resolutionSeconds,
            bucket_start: bucketStart,
            up_count: 0,
            down_count: 0,
            pending_count: 0,
            maintenance_count: 0,
            total_count: 0,
            ping_sum: 0,
            min_ping: null,
            max_ping: null,
        };
        row.up_count += Number(bucket.up_count || 0);
        row.down_count += Number(bucket.down_count || 0);
        row.pending_count += Number(bucket.pending_count || 0);
        row.maintenance_count += Number(bucket.maintenance_count || 0);
        row.total_count += Number(bucket.total_count || 0);
        row.ping_sum += Number(bucket.ping_sum || 0);
        row.min_ping = bucket.min_ping == null
            ? row.min_ping
            : row.min_ping == null
                ? Number(bucket.min_ping)
                : Math.min(row.min_ping, Number(bucket.min_ping));
        row.max_ping = bucket.max_ping == null
            ? row.max_ping
            : row.max_ping == null
                ? Number(bucket.max_ping)
                : Math.max(row.max_ping, Number(bucket.max_ping));
        rowsByKey.set(key, row);
    }

    return [...rowsByKey.values()].toSorted((a, b) => {
        const monitorCompare = Number(a.monitor_id) - Number(b.monitor_id);
        if (monitorCompare !== 0) {
            return monitorCompare;
        }
        return String(a.bucket_start).localeCompare(String(b.bucket_start));
    });
}

function formatTestBucketStart(value, resolutionSeconds) {
    const date = new Date(`${String(value).replace(" ", "T")}Z`);
    if (Number(resolutionSeconds) === 86400) {
        date.setUTCHours(0, 0, 0, 0);
    } else {
        date.setUTCMinutes(0, 0, 0);
    }
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function upsertByKey(rows, key, value, nextRow) {
    const existing = rows.find((row) => Number(row[key]) === Number(value));
    if (existing) {
        Object.assign(existing, nextRow);
    } else {
        rows.push(nextRow);
    }
}

function upsertMetricBucketExact(state, nextBucket) {
    const existing = state.monitorMetricBuckets.find((bucket) =>
        Number(bucket.monitor_id) === Number(nextBucket.monitor_id) &&
        Number(bucket.resolution_seconds) === Number(nextBucket.resolution_seconds) &&
        bucket.bucket_start === nextBucket.bucket_start
    );
    if (existing) {
        Object.assign(existing, nextBucket);
    } else {
        state.monitorMetricBuckets.push(nextBucket);
    }
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
 * Hash a password in the Worker PBKDF2-SHA256 JSON format for auth fixtures.
 * @param {string} password Plain-text password.
 * @returns {Promise<object>} Stored password JSON.
 */
async function hashTestWorkerPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: 100000,
        },
        keyMaterial,
        256
    );
    return {
        algorithm: "PBKDF2-SHA256",
        iterations: 100000,
        salt: base64UrlEncode(salt),
        hash: base64UrlEncode(new Uint8Array(bits)),
    };
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
