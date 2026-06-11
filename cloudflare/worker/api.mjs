import {
    buildTwingateStatusFromRunnerFailure,
    buildUnavailableTwingateStatus,
    resolveTwingateStatusTimeoutMs,
    sanitizeRunnerStatus,
} from "./twingate-status.mjs";

const DIRECT_PROFILE = {
    id: null,
    slug: "direct",
    name: "Direct",
    type: "direct",
    enabled: true,
};

const DEFAULT_SETTINGS = {
    checkUpdate: true,
    searchEngineIndex: false,
    entryPage: "dashboard",
    nscd: true,
    keepDataPeriodDays: 180,
    tlsExpiryNotifyDays: [7, 14, 21],
    domainExpiryNotifyDays: [7, 14, 21],
    trustProxy: false,
    primaryBaseURL: "",
    serverTimezone: "UTC",
    steamAPIKey: "",
    globalpingApiToken: "",
    chromeExecutable: "",
    twingateAlertEnabled: false,
    twingateAlertNotificationIDList: {},
    twingateAlertThresholdMinutes: 5,
};
const DOWN = 0;
const UP = 1;
const PENDING = 2;
const MAINTENANCE = 3;
const WORKER_AUTH_USER_SETTING = "workerAuthUser";
const WORKER_AUTH_SESSION_SECRET_SETTING = "workerAuthSessionSecret";
const WORKER_AUTH_REVOKED_SESSIONS_SETTING = "workerAuthRevokedSessions";
const WORKER_AUTH_TOTP_SETTING = "workerAuthTotp";
const WORKER_STATUS_PAGE_CONFIG_SETTING = "statusPageConfig:default";
const WORKER_STATUS_PAGE_PUBLIC_GROUP_LIST_SETTING = "statusPagePublicGroupList:default";
const WORKER_STATUS_PAGE_ALIAS_SLUGS = new Set(["", "default", "status-page"]);
const WORKER_STATUS_PAGE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEPLOY_MONITOR_PAUSE_SETTING = "deployMonitorPause";
const TWINGATE_ALERT_STATE_SETTING = "twingateAlertState";
const SENSITIVE_SETTING_KEYS = new Set([
    WORKER_AUTH_USER_SETTING,
    WORKER_AUTH_SESSION_SECRET_SETTING,
    WORKER_AUTH_REVOKED_SESSIONS_SETTING,
    WORKER_AUTH_TOTP_SETTING,
    DEPLOY_MONITOR_PAUSE_SETTING,
    TWINGATE_ALERT_STATE_SETTING,
]);
const WORKER_AUTH_PASSWORD_ITERATIONS = 100000;
const WORKER_AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const WORKER_AUTH_REMEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const WORKER_AUTH_TOTP_PERIOD_SECONDS = 30;
const WORKER_AUTH_TOTP_WINDOW = 1;
const WORKER_HEARTBEAT_RESPONSE_MAX_CHARS = 64 * 1024;
const DEFAULT_MONITOR_INTERVAL_SECONDS = 60;
const DEFAULT_DEPLOY_MONITOR_PAUSE_SECONDS = 120;
const DEFAULT_TWINGATE_ALERT_THRESHOLD_MINUTES = 5;
const MIN_TWINGATE_ALERT_THRESHOLD_MINUTES = 1;
const MAX_TWINGATE_ALERT_THRESHOLD_MINUTES = 1440;
const DEFAULT_RECENT_HEARTBEAT_HISTORY_LIMIT = 150;
const MAX_RECENT_HEARTBEAT_HISTORY_LIMIT = 500;
const DASHBOARD_HEARTBEAT_BAR_LIMIT = 150;
const STATUS_PAGE_HEARTBEAT_LIMIT = 100;
const DASHBOARD_BACKFILL_MONITOR_LIMIT = 25;
const DASHBOARD_BACKFILL_HEARTBEAT_LIMIT = 10000;
const DEFAULT_DASHBOARD_CHART_PERIOD_HOURS = 1;
const DASHBOARD_CHART_PERIODS = new Set([0.5, 1, 3, 6, 24, 168, 720]);
const DASHBOARD_METRIC_RESOLUTIONS = [60, 3600, 86400];
const HOT_PATH_DASHBOARD_METRIC_RESOLUTIONS = [60];
const DASHBOARD_ROLLUP_RESOLUTIONS = [3600, 86400];
const DEFAULT_OK_HEARTBEAT_SAMPLE_SECONDS = 15 * 60;
const SCHEDULED_BACKFILL_INTERVAL_MS = 15 * 60 * 1000;
const SCHEDULED_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SCHEDULED_TWINGATE_ALERT_INTERVAL_MS = 5 * 60 * 1000;
const ACCESS_SECRET_HEADER = "X-Uptime-Worker-Token";
const ACCESS_SECRET_MONITOR_TYPES = new Set(["http", "keyword", "json-query"]);
const NOTIFICATION_OK_MESSAGE = "Sent Successfully.";
const DEFAULT_APP_VERSION = "1.0.0";
const DEPLOY_MONITOR_PAUSE_MESSAGE = "Monitor checks are paused during Worker deployment";
const MONITOR_PAUSED_MESSAGE = "Monitor is paused";
const TWINGATE_SERVICE_NOT_RUNNING_MESSAGE = "Twingate service isn't running";
const LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE = 100;

const WORKER_MONITOR_TYPES = new Set([
    "group",
    "http",
    "keyword",
    "json-query",
    "ping",
    "port",
    "websocket-upgrade",
]);

const MONITOR_CONFIG_EXCLUDED_FIELDS = new Set([
    "id",
    "active",
    "lastHeartbeat",
    "path",
    "pathName",
    "childrenIDs",
    "tags",
    "notificationIDList",
    "proxyId",
    "proxy_id",
    "parent",
    "parentName",
    "parent_name",
    "groupName",
    "group_name",
    "getUrl",
    "__derivedGroupPath",
]);

const MISSING_CONFIG_JSON_COLUMN = /no such column:\s*(?:\w+\.)?config_json/i;
const MISSING_PARENT_COLUMN = /(?:no such column:\s*parent|no column named parent)/i;
const NOTIFICATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    user_id INTEGER,
    is_default INTEGER NOT NULL DEFAULT 0,
    config TEXT
)`;
const MONITOR_NOTIFICATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS monitor_notification (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    notification_id INTEGER NOT NULL,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (notification_id) REFERENCES notification(id) ON DELETE CASCADE ON UPDATE CASCADE
)`;
const MONITOR_NOTIFICATION_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS monitor_notification_index ON monitor_notification(monitor_id, notification_id)";
const TAG_TABLE_SQL = `CREATE TABLE IF NOT EXISTS tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const MONITOR_TAG_TABLE_SQL = `CREATE TABLE IF NOT EXISTS monitor_tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    value TEXT,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tag(id) ON DELETE CASCADE ON UPDATE CASCADE
)`;
const MONITOR_TAG_MONITOR_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS monitor_tag_monitor_id_index ON monitor_tag(monitor_id)";
const MONITOR_TAG_TAG_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS monitor_tag_tag_id_index ON monitor_tag(tag_id)";
const PROXY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS proxy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    protocol TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    auth INTEGER NOT NULL DEFAULT 0,
    username TEXT,
    password TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    "default" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const PROXY_INDEX_SQL = `CREATE INDEX IF NOT EXISTS idx_proxy_default ON proxy("default")`;
const DOCKER_HOST_TABLE_SQL = `CREATE TABLE IF NOT EXISTS docker_host (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    docker_daemon TEXT NOT NULL,
    docker_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const REMOTE_BROWSER_TABLE_SQL = `CREATE TABLE IF NOT EXISTS remote_browser (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const MONITOR_RUNTIME_SUMMARY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS monitor_runtime_summary (
    monitor_id INTEGER PRIMARY KEY,
    latest_heartbeat_id INTEGER,
    status INTEGER,
    ping INTEGER,
    msg TEXT,
    checked_at TEXT,
    avg_ping REAL,
    uptime_24 REAL,
    uptime_720 REAL,
    uptime_1y REAL,
    heartbeat_bar_json TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (latest_heartbeat_id) REFERENCES heartbeats(id) ON DELETE SET NULL
)`;
const MONITOR_EVENT_LOG_TABLE_SQL = `CREATE TABLE IF NOT EXISTS monitor_event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    heartbeat_id INTEGER NOT NULL UNIQUE,
    monitor_id INTEGER NOT NULL,
    status INTEGER NOT NULL,
    ping INTEGER,
    msg TEXT,
    checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (heartbeat_id) REFERENCES heartbeats(id) ON DELETE CASCADE
)`;
const MONITOR_EVENT_LOG_CHECKED_AT_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS idx_monitor_event_log_checked_at ON monitor_event_log(checked_at DESC, id DESC)";
const MONITOR_EVENT_LOG_MONITOR_CHECKED_AT_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS idx_monitor_event_log_monitor_checked_at ON monitor_event_log(monitor_id, checked_at DESC, id DESC)";
const MONITOR_METRIC_BUCKET_TABLE_SQL = `CREATE TABLE IF NOT EXISTS monitor_metric_bucket (
    monitor_id INTEGER NOT NULL,
    resolution_seconds INTEGER NOT NULL,
    bucket_start TEXT NOT NULL,
    up_count INTEGER NOT NULL DEFAULT 0,
    down_count INTEGER NOT NULL DEFAULT 0,
    pending_count INTEGER NOT NULL DEFAULT 0,
    maintenance_count INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    ping_sum REAL NOT NULL DEFAULT 0,
    min_ping REAL,
    max_ping REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (monitor_id, resolution_seconds, bucket_start),
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
)`;
const MONITOR_METRIC_BUCKET_LOOKUP_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS idx_monitor_metric_bucket_lookup ON monitor_metric_bucket(monitor_id, resolution_seconds, bucket_start)";
const DASHBOARD_RUNTIME_CACHE_SCHEMA_SQL = [
    MONITOR_RUNTIME_SUMMARY_TABLE_SQL,
    MONITOR_EVENT_LOG_TABLE_SQL,
    MONITOR_EVENT_LOG_CHECKED_AT_INDEX_SQL,
    MONITOR_EVENT_LOG_MONITOR_CHECKED_AT_INDEX_SQL,
    MONITOR_METRIC_BUCKET_TABLE_SQL,
    MONITOR_METRIC_BUCKET_LOOKUP_INDEX_SQL,
];
const ACCESS_CERT_CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_ACCESS_CERT_LOOKUP_TIMEOUT_MS = 5000;
const accessCertCache = new Map();
const dashboardRuntimeCacheSchemaReady = new WeakMap();
const SUPPORTED_PROXY_PROTOCOLS = new Set(["http", "https", "socks", "socks5", "socks5h", "socks4"]);
const USER_TABLE_SQL = `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'operator', 'viewer')),
    password_json TEXT NOT NULL,
    totp_json TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
)`;
const USER_ROLE_ACTIVE_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active)";
const USER_SESSION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT,
    user_agent TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`;
const USER_SESSION_USER_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)";
const USER_SESSION_EXPIRY_INDEX_SQL = "CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)";
const USER_AUDIT_LOG_TABLE_SQL = `CREATE TABLE IF NOT EXISTS user_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id INTEGER,
    user_id INTEGER,
    action TEXT NOT NULL,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
)`;
const USER_AUDIT_LOG_USER_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS idx_user_audit_log_user_id ON user_audit_log(user_id, created_at DESC)";
const USER_AUDIT_LOG_ACTOR_INDEX_SQL =
    "CREATE INDEX IF NOT EXISTS idx_user_audit_log_actor_user_id ON user_audit_log(actor_user_id, created_at DESC)";
const USER_AUTH_SCHEMA_SQL = [
    USER_TABLE_SQL,
    USER_ROLE_ACTIVE_INDEX_SQL,
    USER_SESSION_TABLE_SQL,
    USER_SESSION_USER_INDEX_SQL,
    USER_SESSION_EXPIRY_INDEX_SQL,
    USER_AUDIT_LOG_TABLE_SQL,
    USER_AUDIT_LOG_USER_INDEX_SQL,
    USER_AUDIT_LOG_ACTOR_INDEX_SQL,
];
const VALID_USER_ROLES = new Set(["admin", "editor", "operator", "viewer"]);
const ALL_PERMISSIONS = [
    "dashboard.read",
    "monitors.read",
    "monitors.write",
    "monitors.delete",
    "monitors.run",
    "monitors.pause",
    "heartbeats.read",
    "heartbeats.clear",
    "settings.read",
    "settings.write",
    "notifications.read",
    "notifications.write",
    "notifications.test",
    "tags.read",
    "tags.write",
    "proxies.read",
    "proxies.write",
    "docker-hosts.read",
    "docker-hosts.write",
    "docker-hosts.test",
    "remote-browsers.read",
    "remote-browsers.write",
    "remote-browsers.test",
    "status-pages.read",
    "status-pages.write",
    "network-profiles.read",
    "network-profiles.write",
    "twingate.read",
    "statistics.clear",
    "security.self",
    "security.manage",
    "users.read",
    "users.write",
    "users.delete",
];
const ALL_PERMISSION_SET = new Set(ALL_PERMISSIONS);
const ROLE_PERMISSIONS = {
    admin: ALL_PERMISSIONS,
    editor: [
        "dashboard.read",
        "monitors.read",
        "monitors.write",
        "monitors.delete",
        "monitors.run",
        "monitors.pause",
        "heartbeats.read",
        "heartbeats.clear",
        "settings.read",
        "settings.write",
        "notifications.read",
        "notifications.write",
        "notifications.test",
        "tags.read",
        "tags.write",
        "proxies.read",
        "proxies.write",
        "docker-hosts.read",
        "docker-hosts.write",
        "docker-hosts.test",
        "remote-browsers.read",
        "remote-browsers.write",
        "remote-browsers.test",
        "status-pages.read",
        "status-pages.write",
        "network-profiles.read",
        "network-profiles.write",
        "twingate.read",
        "statistics.clear",
        "security.self",
    ],
    operator: [
        "dashboard.read",
        "monitors.read",
        "monitors.run",
        "monitors.pause",
        "heartbeats.read",
        "heartbeats.clear",
        "settings.read",
        "notifications.read",
        "tags.read",
        "proxies.read",
        "docker-hosts.read",
        "remote-browsers.read",
        "status-pages.read",
        "network-profiles.read",
        "twingate.read",
        "security.self",
    ],
    viewer: [
        "dashboard.read",
        "monitors.read",
        "heartbeats.read",
        "settings.read",
        "notifications.read",
        "tags.read",
        "proxies.read",
        "docker-hosts.read",
        "remote-browsers.read",
        "status-pages.read",
        "network-profiles.read",
        "security.self",
    ],
};
const ROUTE_PERMISSIONS = new Map([
    ["monitors", "monitors.read"],
    ["dashboard-bootstrap", "dashboard.read"],
    ["settings", "settings.read"],
    ["docker-hosts", "docker-hosts.read"],
    ["save-docker-host", "docker-hosts.write"],
    ["delete-docker-host", "docker-hosts.write"],
    ["test-docker-host", "docker-hosts.test"],
    ["remote-browsers", "remote-browsers.read"],
    ["save-remote-browser", "remote-browsers.write"],
    ["delete-remote-browser", "remote-browsers.write"],
    ["test-remote-browser", "remote-browsers.test"],
    ["proxies", "proxies.read"],
    ["save-proxy", "proxies.write"],
    ["delete-proxy", "proxies.write"],
    ["notifications", "notifications.read"],
    ["save-notification", "notifications.write"],
    ["delete-notification", "notifications.write"],
    ["test-notification", "notifications.test"],
    ["tags", "tags.read"],
    ["save-tag", "tags.write"],
    ["delete-tag", "tags.write"],
    ["add-monitor-tag", "tags.write"],
    ["delete-monitor-tag", "tags.write"],
    ["create-monitor", "monitors.write"],
    ["import-monitors", "monitors.write"],
    ["monitor", "monitors.read"],
    ["update-monitor", "monitors.write"],
    ["set-monitor-active", "monitors.pause"],
    ["delete-monitor", "monitors.delete"],
    ["heartbeats", "heartbeats.read"],
    ["recent-heartbeats", "heartbeats.read"],
    ["monitor-chart", "heartbeats.read"],
    ["network-profiles", "network-profiles.read"],
    ["patch-network-route", "network-profiles.write"],
    ["check-now", "monitors.run"],
    ["twingate-status", "twingate.read"],
    ["auth-local-user", "security.self"],
    ["auth-2fa-status", "security.self"],
    ["auth-2fa-prepare", "security.self"],
    ["auth-2fa-verify", "security.self"],
    ["auth-2fa-save", "security.self"],
    ["auth-2fa-disable", "security.self"],
    ["save-status-page", "status-pages.write"],
    ["statistics", "statistics.clear"],
    ["users", "users.read"],
    ["create-user", "users.write"],
    ["user", "users.read"],
    ["update-user", "users.write"],
    ["delete-user", "users.delete"],
    ["set-user-password", "users.write"],
    ["reset-user-2fa", "users.write"],
]);
const PRIVATE_WORKER_HOST_ERROR =
    "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts";
const DUPLICATE_COLUMN_ERROR = /duplicate column name:\s*(parent|proxy_id)/i;
const userAuthSchemaReady = new WeakMap();

export async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);

    try {
        const actor = await requireRoutePermission(request, env, route);

        if (route.name === "entry-page") {
            return json({ type: "entryPage", entryPage: "dashboard" });
        }

        if (route.name === "health") {
            return json({
                ok: true,
                name: "uptimeworker",
                version: resolveAppVersion(env),
            });
        }

        if (route.name === "auth-session") {
            return json(await getWorkerAuthSession(request, env));
        }

        if (route.name === "auth-login") {
            return json(await loginWorkerAuthUser(env, await request.json()));
        }

        if (route.name === "auth-logout") {
            return json(await logoutWorkerAuthSession(request, env));
        }

        if (route.name === "auth-local-user") {
            return json(await saveWorkerAuthUser(env, await request.json(), actor));
        }

        if (route.name === "auth-2fa-status") {
            return json(await getWorkerTwoFAStatus(env, actor));
        }

        if (route.name === "auth-2fa-prepare") {
            return json(await prepareWorkerTwoFA(env, await request.json(), actor));
        }

        if (route.name === "auth-2fa-verify") {
            return json(await verifyWorkerTwoFAToken(env, await request.json(), actor));
        }

        if (route.name === "auth-2fa-save") {
            return json(await saveWorkerTwoFA(env, await request.json(), actor));
        }

        if (route.name === "auth-2fa-disable") {
            return json(await disableWorkerTwoFA(env, await request.json(), actor));
        }

        if (route.name === "monitors") {
            return json({ monitors: await listMonitors(env) });
        }

        if (route.name === "dashboard-bootstrap") {
            return json(await getDashboardBootstrap(env));
        }

        if (route.name === "heartbeats") {
            const offset = Number(url.searchParams.get("offset") || 0);
            const count = Number(url.searchParams.get("count") || 100);
            const importantOnly = ["1", "true"].includes(
                String(url.searchParams.get("important") || "").toLowerCase()
            );
            return json(await listHeartbeats(env, offset, count, {
                importantOnly,
            }));
        }

        if (route.name === "recent-heartbeats") {
            const body = await request.json().catch(() => ({}));
            return json({
                heartbeatsByMonitorId: await listRecentHeartbeatsByMonitorId(env, body.monitorIds, body.count),
            });
        }

        if (route.name === "status-pages") {
            return json({ statusPages: await listStatusPages(env) });
        }

        if (route.name === "status-page") {
            return json(await getStatusPageData(env, route.params.slug));
        }

        if (route.name === "save-status-page") {
            return json(await saveStatusPageData(env, route.params.slug, await request.json()));
        }

        if (route.name === "status-page-heartbeat") {
            return json(await getStatusPageHeartbeatData(env, route.params.slug));
        }

        if (route.name === "status-page-incident-history") {
            const config = await getWorkerStatusPageConfig(env);
            assertWorkerStatusPageSlug(route.params.slug, config);
            return json({ ok: true, incidents: [], nextCursor: null, hasMore: false });
        }

        if (route.name === "settings") {
            if (request.method === "GET") {
                return json({ data: await getUiSettings(env) });
            }
            await setUiSettings(env, await request.json());
            return json({ ok: true, msg: "Settings saved" });
        }

        if (route.name === "users") {
            return json({ users: await listUsers(env) });
        }

        if (route.name === "create-user") {
            return json({
                ok: true,
                user: await createUser(env, await request.json(), actor),
            });
        }

        if (route.name === "user") {
            return json({ user: await requireUserForResponse(env, Number(route.params.userId)) });
        }

        if (route.name === "update-user") {
            return json({
                ok: true,
                user: await updateUser(env, Number(route.params.userId), await request.json(), actor),
            });
        }

        if (route.name === "delete-user") {
            await deleteUser(env, Number(route.params.userId), actor);
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "set-user-password") {
            await setUserPassword(env, Number(route.params.userId), await request.json(), actor);
            return json({ ok: true, msg: "Password updated" });
        }

        if (route.name === "reset-user-2fa") {
            await resetUserTwoFA(env, Number(route.params.userId), actor);
            return json({ ok: true, msg: "2faDisabled", msgi18n: true });
        }

        if (route.name === "docker-hosts") {
            return json({ dockerHosts: await listDockerHosts(env) });
        }

        if (route.name === "save-docker-host") {
            const dockerHost = await saveDockerHost(env, await request.json(), route.params.dockerHostId);
            return json({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: dockerHost.id,
            });
        }

        if (route.name === "delete-docker-host") {
            await deleteDockerHost(env, Number(route.params.dockerHostId));
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "test-docker-host") {
            normalizeDockerHostInput(await request.json());
            return json({
                ok: false,
                msg: "Docker host testing is not available in the Cloudflare Worker UI yet.",
            });
        }

        if (route.name === "remote-browsers") {
            return json({ remoteBrowsers: await listRemoteBrowsers(env) });
        }

        if (route.name === "save-remote-browser") {
            const remoteBrowser = await saveRemoteBrowser(env, await request.json(), route.params.remoteBrowserId);
            return json({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: remoteBrowser.id,
            });
        }

        if (route.name === "delete-remote-browser") {
            await deleteRemoteBrowser(env, Number(route.params.remoteBrowserId));
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "test-remote-browser") {
            normalizeRemoteBrowserInput(await request.json());
            return json({
                ok: false,
                msg: "Remote browser connection testing is not available in the Cloudflare Worker UI yet.",
            });
        }

        if (route.name === "proxies") {
            return json({ proxies: await listProxies(env) });
        }

        if (route.name === "save-proxy") {
            const proxy = await saveProxy(env, await request.json(), route.params.proxyId);
            return json({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: proxy.id,
            });
        }

        if (route.name === "delete-proxy") {
            await deleteProxy(env, Number(route.params.proxyId));
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "notifications") {
            return json({ notifications: await listNotifications(env) });
        }

        if (route.name === "save-notification") {
            const notification = await saveNotification(env, await request.json(), route.params.notificationId);
            return json({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                id: notification.id,
            });
        }

        if (route.name === "delete-notification") {
            await deleteNotification(env, Number(route.params.notificationId));
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "test-notification") {
            return json(await testNotification(await request.json()));
        }

        if (route.name === "tags") {
            return json({ tags: await listTags(env) });
        }

        if (route.name === "save-tag") {
            const tag = await saveTag(env, await request.json(), route.params.tagId);
            return json({
                ok: true,
                msg: "Saved.",
                msgi18n: true,
                tag,
            });
        }

        if (route.name === "delete-tag") {
            await deleteTag(env, Number(route.params.tagId));
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "add-monitor-tag") {
            const body = await request.json();
            await addMonitorTag(env, Number(route.params.monitorId), body.tagId, body.value);
            return json({ ok: true, msg: "successAdded", msgi18n: true });
        }

        if (route.name === "delete-monitor-tag") {
            const body = await request.json();
            await deleteMonitorTag(env, Number(route.params.monitorId), body.tagId, body.value);
            return json({ ok: true, msg: "successDeleted", msgi18n: true });
        }

        if (route.name === "create-monitor") {
            const monitorID = await createMonitor(env, await request.json());
            const monitor = await getSerializedMonitor(env, monitorID);
            return json({ ok: true, msg: "Monitor saved", monitorID, monitor });
        }

        if (route.name === "import-monitors") {
            return json(await importMonitors(env, await request.json()));
        }

        if (route.name === "monitor") {
            const monitor = await getSerializedMonitor(env, Number(route.params.monitorId));
            if (!monitor) {
                throw httpError(404, "Monitor not found");
            }
            return json({ ok: true, monitor });
        }

        if (route.name === "update-monitor") {
            const monitorId = Number(route.params.monitorId);
            await updateMonitor(env, monitorId, await request.json());
            return json({ ok: true, msg: "Monitor saved" });
        }

        if (route.name === "set-monitor-active") {
            const monitorId = Number(route.params.monitorId);
            const body = await request.json();
            const active = Boolean(body.active);
            await setMonitorActive(env, monitorId, active);
            const monitor = await getSerializedMonitor(env, monitorId);
            return json({ ok: true, active, monitor });
        }

        if (route.name === "delete-monitor") {
            await deleteMonitor(env, Number(route.params.monitorId));
            return json({ ok: true, msg: "Deleted" });
        }

        if (route.name === "monitor-heartbeats") {
            if (request.method === "GET") {
                const offset = Number(url.searchParams.get("offset") || 0);
                const count = Number(url.searchParams.get("count") || 100);
                const importantOnly = ["1", "true"].includes(
                    String(url.searchParams.get("important") || "").toLowerCase()
                );
                return json(await listMonitorHeartbeats(env, Number(route.params.monitorId), offset, count, {
                    importantOnly,
                }));
            }
            await clearMonitorHeartbeats(env, Number(route.params.monitorId));
            return json({ ok: true, msg: "Heartbeats cleared" });
        }

        if (route.name === "monitor-chart") {
            const period = Number(url.searchParams.get("period") || DEFAULT_DASHBOARD_CHART_PERIOD_HOURS);
            return json({
                ok: true,
                data: await getMonitorChartData(env, Number(route.params.monitorId), period),
            });
        }

        if (route.name === "statistics") {
            await clearAllStatistics(env);
            return json({ ok: true, msg: "Statistics cleared" });
        }

        if (route.name === "network-profiles") {
            return json({ profiles: await listNetworkProfiles(env) });
        }

        if (route.name === "patch-network-route") {
            const body = await request.json();
            const networkProfileId = normalizeNetworkProfileId(body.networkProfileId);
            await updateMonitorNetworkRoute(env, Number(route.params.monitorId), networkProfileId);
            return json({ ok: true, networkProfileId });
        }

        if (route.name === "check-now") {
            const result = await executeMonitorCheck(env, Number(route.params.monitorId));
            return json({ result });
        }

        if (route.name === "twingate-status") {
            const status = await fetchRunnerStatus(env);
            return json(status);
        }

        return json({ error: "Not found" }, 404);
    } catch (error) {
        return json({ error: error.message }, error.status || 500);
    }
}

export async function listNetworkProfiles(env) {
    const result = await env.DB.prepare(
        "SELECT id, slug, name, type, enabled FROM network_profiles WHERE enabled = 1 ORDER BY name"
    ).all();
    const profiles = (result.results || []).map((profile) => ({
        ...profile,
        enabled: Boolean(profile.enabled),
    }));
    return [DIRECT_PROFILE, ...profiles];
}

export async function getUiSettings(env) {
    const result = await env.DB.prepare("SELECT key, value FROM app_settings").all();
    const stored = {};
    for (const row of result.results || []) {
        if (SENSITIVE_SETTING_KEYS.has(row.key)) {
            continue;
        }
        try {
            stored[row.key] = JSON.parse(row.value);
        } catch (_) {
            stored[row.key] = row.value;
        }
    }
    return {
        ...DEFAULT_SETTINGS,
        ...stored,
    };
}

export async function setUiSettings(env, settings) {
    const merged = {
        ...DEFAULT_SETTINGS,
        ...(settings || {}),
    };
    const existing = await env.DB.prepare("SELECT key, value FROM app_settings").all();
    const existingByKey = new Map((existing.results || []).map((row) => [row.key, row.value]));
    const statements = [];
    for (const [key, value] of Object.entries(merged)) {
        if (SENSITIVE_SETTING_KEYS.has(key)) {
            continue;
        }
        const serialized = JSON.stringify(value);
        if (existingByKey.get(key) === serialized) {
            continue;
        }
        statements.push(
            env.DB.prepare(
                `INSERT INTO app_settings (key, value, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP`
            ).bind(key, serialized)
        );
    }
    if (statements.length > 0) {
        await env.DB.batch(statements);
    }
}

export async function listDockerHosts(env) {
    await ensureDockerHostTable(env);
    const result = await env.DB.prepare(
        `SELECT id, user_id, name, docker_daemon, docker_type
         FROM docker_host
         ORDER BY name`
    ).all();
    return (result.results || []).map(serializeDockerHost);
}

export async function saveDockerHost(env, dockerHostInput, dockerHostId = null) {
    await ensureDockerHostTable(env);
    const dockerHost = normalizeDockerHostInput(dockerHostInput);

    if (dockerHostId) {
        const existing = await getDockerHost(env, Number(dockerHostId));
        if (!existing) {
            throw httpError(404, "docker host not found");
        }
        await env.DB.prepare(
            `UPDATE docker_host
             SET name = ?, docker_daemon = ?, docker_type = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(dockerHost.name, dockerHost.dockerDaemon, dockerHost.dockerType, Number(dockerHostId))
            .run();
        return { id: Number(dockerHostId) };
    }

    const result = await env.DB.prepare(
        `INSERT INTO docker_host (user_id, name, docker_daemon, docker_type)
         VALUES (?, ?, ?, ?)`
    )
        .bind(1, dockerHost.name, dockerHost.dockerDaemon, dockerHost.dockerType)
        .run();
    const id = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    return { id };
}

export async function deleteDockerHost(env, dockerHostId) {
    await ensureDockerHostTable(env);
    const existing = await getDockerHost(env, dockerHostId);
    if (!existing) {
        throw httpError(404, "docker host not found");
    }
    await env.DB.prepare("DELETE FROM docker_host WHERE id = ?").bind(dockerHostId).run();
}

async function getDockerHost(env, dockerHostId) {
    await ensureDockerHostTable(env);
    return await env.DB.prepare(
        `SELECT id, user_id, name, docker_daemon, docker_type
         FROM docker_host
         WHERE id = ?`
    )
        .bind(dockerHostId)
        .first();
}

async function ensureDockerHostTable(env) {
    await env.DB.prepare(DOCKER_HOST_TABLE_SQL).run();
}

function normalizeDockerHostInput(dockerHostInput = {}) {
    const name = String(dockerHostInput.name || "").trim();
    if (!name) {
        throw httpError(400, "Docker host name is required");
    }

    const dockerDaemon = String(dockerHostInput.dockerDaemon || dockerHostInput.docker_daemon || "").trim();
    if (!dockerDaemon) {
        throw httpError(400, "Docker daemon is required");
    }

    const dockerType = String(dockerHostInput.dockerType || dockerHostInput.docker_type || "socket").trim();
    if (!["socket", "tcp"].includes(dockerType)) {
        throw httpError(400, `Unsupported Docker connection type "${dockerType}"`);
    }

    if (dockerType === "tcp") {
        let url;
        try {
            url = new URL(dockerDaemon);
        } catch (_) {
            throw httpError(400, "Docker TCP daemon must be a valid URL");
        }
        if (!["http:", "https:"].includes(url.protocol)) {
            throw httpError(400, "Docker TCP daemon must use http or https");
        }
    }

    return {
        name,
        dockerDaemon,
        dockerType,
    };
}

function serializeDockerHost(row) {
    return {
        id: Number(row.id),
        user_id: row.user_id == null ? 1 : Number(row.user_id),
        name: row.name,
        dockerDaemon: row.docker_daemon,
        dockerType: row.docker_type,
    };
}

export async function listRemoteBrowsers(env) {
    await ensureRemoteBrowserTable(env);
    const result = await env.DB.prepare(
        `SELECT id, user_id, name, url
         FROM remote_browser
         ORDER BY name`
    ).all();
    return (result.results || []).map(serializeRemoteBrowser);
}

export async function saveRemoteBrowser(env, remoteBrowserInput, remoteBrowserId = null) {
    await ensureRemoteBrowserTable(env);
    const remoteBrowser = normalizeRemoteBrowserInput(remoteBrowserInput);

    if (remoteBrowserId) {
        const existing = await getRemoteBrowser(env, Number(remoteBrowserId));
        if (!existing) {
            throw httpError(404, "Remote Browser not found!");
        }
        await env.DB.prepare(
            `UPDATE remote_browser
             SET name = ?, url = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(remoteBrowser.name, remoteBrowser.url, Number(remoteBrowserId))
            .run();
        return { id: Number(remoteBrowserId) };
    }

    const result = await env.DB.prepare(
        `INSERT INTO remote_browser (user_id, name, url)
         VALUES (?, ?, ?)`
    )
        .bind(1, remoteBrowser.name, remoteBrowser.url)
        .run();
    const id = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    return { id };
}

export async function deleteRemoteBrowser(env, remoteBrowserId) {
    await ensureRemoteBrowserTable(env);
    const existing = await getRemoteBrowser(env, remoteBrowserId);
    if (!existing) {
        throw httpError(404, "Remote Browser not found!");
    }
    await env.DB.prepare("DELETE FROM remote_browser WHERE id = ?").bind(remoteBrowserId).run();
}

async function getRemoteBrowser(env, remoteBrowserId) {
    await ensureRemoteBrowserTable(env);
    return await env.DB.prepare(
        `SELECT id, user_id, name, url
         FROM remote_browser
         WHERE id = ?`
    )
        .bind(remoteBrowserId)
        .first();
}

async function ensureRemoteBrowserTable(env) {
    await env.DB.prepare(REMOTE_BROWSER_TABLE_SQL).run();
}

/**
 * Ensure the derived dashboard cache tables exist before reading or writing them.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<void>} Completion promise.
 */
async function ensureDashboardRuntimeCacheTables(env) {
    let ready = dashboardRuntimeCacheSchemaReady.get(env.DB);
    if (!ready) {
        ready = (async () => {
            for (const sql of DASHBOARD_RUNTIME_CACHE_SCHEMA_SQL) {
                await env.DB.prepare(sql).run();
            }
        })();
        dashboardRuntimeCacheSchemaReady.set(env.DB, ready);
    }

    try {
        await ready;
    } catch (error) {
        dashboardRuntimeCacheSchemaReady.delete(env.DB);
        throw error;
    }
}

function normalizeRemoteBrowserInput(remoteBrowserInput = {}) {
    const name = String(remoteBrowserInput.name || "").trim();
    if (!name) {
        throw httpError(400, "Remote browser name is required");
    }

    const url = String(remoteBrowserInput.url || "").trim();
    if (!url) {
        throw httpError(400, "Remote browser URL is required");
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch (_) {
        throw httpError(400, "Remote browser URL must be a valid URL");
    }
    if (!["ws:", "wss:"].includes(parsed.protocol)) {
        throw httpError(400, "Remote browser URL must use ws or wss");
    }

    return {
        name,
        url: parsed.toString(),
    };
}

function serializeRemoteBrowser(row) {
    return {
        id: Number(row.id),
        user_id: row.user_id == null ? 1 : Number(row.user_id),
        name: row.name,
        url: row.url,
    };
}

export async function listProxies(env) {
    await ensureProxyTables(env);
    const result = await env.DB.prepare(
        `SELECT id, user_id, protocol, host, port, auth, username, password, active, "default"
         FROM proxy
         ORDER BY host, port`
    ).all();
    return (result.results || []).map(serializeProxy);
}

export async function saveProxy(env, proxyInput, proxyId = null) {
    await ensureProxyTables(env);
    const proxy = normalizeProxyInput(proxyInput);

    if (proxy.isDefault) {
        await env.DB.prepare(`UPDATE proxy SET "default" = 0 WHERE "default" = 1`).run();
    }

    if (proxyId) {
        const existing = await getProxy(env, Number(proxyId));
        if (!existing) {
            throw httpError(404, "proxy not found");
        }
        await env.DB.prepare(
            `UPDATE proxy
             SET protocol = ?, host = ?, port = ?, auth = ?, username = ?, password = ?,
                 active = ?, "default" = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(
                proxy.protocol,
                proxy.host,
                proxy.port,
                proxy.auth ? 1 : 0,
                proxy.auth ? proxy.username : null,
                proxy.auth ? proxy.password : null,
                proxy.active ? 1 : 0,
                proxy.isDefault ? 1 : 0,
                Number(proxyId)
            )
            .run();

        if (proxy.applyExisting) {
            await applyProxyToAllMonitors(env, Number(proxyId));
        }

        return { id: Number(proxyId) };
    }

    const result = await env.DB.prepare(
        `INSERT INTO proxy (user_id, protocol, host, port, auth, username, password, active, "default")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(
            1,
            proxy.protocol,
            proxy.host,
            proxy.port,
            proxy.auth ? 1 : 0,
            proxy.auth ? proxy.username : null,
            proxy.auth ? proxy.password : null,
            proxy.active ? 1 : 0,
            proxy.isDefault ? 1 : 0
        )
        .run();
    const id = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);

    if (proxy.applyExisting) {
        await applyProxyToAllMonitors(env, id);
    }

    return { id };
}

export async function deleteProxy(env, proxyId) {
    await ensureProxyTables(env);
    const existing = await getProxy(env, proxyId);
    if (!existing) {
        throw httpError(404, "proxy not found");
    }
    await env.DB.prepare("UPDATE monitors SET proxy_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE proxy_id = ?")
        .bind(proxyId)
        .run();
    await env.DB.prepare("DELETE FROM proxy WHERE id = ?").bind(proxyId).run();
}

async function getProxy(env, proxyId) {
    await ensureProxyTables(env);
    return await env.DB.prepare(
        `SELECT id, user_id, protocol, host, port, auth, username, password, active, "default"
         FROM proxy
         WHERE id = ?`
    )
        .bind(proxyId)
        .first();
}

async function getActiveProxy(env, proxyId) {
    if (!proxyId) {
        return null;
    }
    const proxy = await getProxy(env, Number(proxyId));
    if (!proxy || !Boolean(proxy.active)) {
        return null;
    }
    return serializeRunnerProxy(proxy);
}

async function getDefaultProxyId(env) {
    await ensureProxyTables(env);
    const proxy = await env.DB.prepare(`SELECT id FROM proxy WHERE "default" = 1 AND active = 1 ORDER BY id LIMIT 1`)
        .first();
    return proxy ? Number(proxy.id) : null;
}

async function applyProxyToAllMonitors(env, proxyId) {
    await env.DB.prepare("UPDATE monitors SET proxy_id = ?, updated_at = CURRENT_TIMESTAMP")
        .bind(proxyId)
        .run();
}

async function ensureProxyTables(env) {
    await env.DB.prepare(PROXY_TABLE_SQL).run();
    await env.DB.prepare(PROXY_INDEX_SQL).run();
    if (!(await isMissingColumn(env, "monitors", "proxy_id"))) {
        return;
    }
    try {
        await env.DB.prepare("ALTER TABLE monitors ADD COLUMN proxy_id INTEGER").run();
    } catch (error) {
        if (!DUPLICATE_COLUMN_ERROR.test(error.message || "")) {
            throw error;
        }
    }
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monitors_proxy_id ON monitors(proxy_id)").run();
}

function normalizeProxyInput(proxyInput = {}) {
    const protocol = String(proxyInput.protocol || "http").trim().toLowerCase();
    if (!SUPPORTED_PROXY_PROTOCOLS.has(protocol)) {
        throw httpError(400, `Unsupported proxy protocol "${protocol}"`);
    }
    const host = String(proxyInput.host || "").trim();
    if (!host) {
        throw httpError(400, "Proxy host is required");
    }
    const port = Number(proxyInput.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw httpError(400, "Proxy port must be between 1 and 65535");
    }
    const auth = Boolean(proxyInput.auth);
    const username = proxyInput.username == null ? null : String(proxyInput.username);
    const password = proxyInput.password == null ? null : String(proxyInput.password);
    if (auth && (!username || !password)) {
        throw httpError(400, "Proxy username and password are required");
    }
    return {
        protocol,
        host,
        port,
        auth,
        username,
        password,
        active: proxyInput.active !== false,
        isDefault: Boolean(proxyInput.default),
        applyExisting: Boolean(proxyInput.applyExisting),
    };
}

function serializeProxy(row) {
    return {
        id: Number(row.id),
        user_id: row.user_id == null ? 1 : Number(row.user_id),
        protocol: row.protocol,
        host: row.host,
        port: Number(row.port),
        auth: Boolean(row.auth),
        username: row.username ?? null,
        password: row.password ?? null,
        active: row.active === undefined ? true : Boolean(row.active),
        default: Boolean(row.default),
    };
}

function serializeRunnerProxy(row) {
    const proxy = serializeProxy(row);
    return {
        id: proxy.id,
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
        auth: proxy.auth,
        username: proxy.username,
        password: proxy.password,
        active: proxy.active,
    };
}

export async function listNotifications(env) {
    await ensureNotificationTables(env);
    const result = await env.DB.prepare(
        `SELECT id, name, active, user_id, is_default, config
         FROM notification
         ORDER BY name`
    ).all();
    return (result.results || []).map(serializeNotification);
}

export async function saveNotification(env, notificationInput, notificationId = null) {
    await ensureNotificationTables(env);
    const notification = normalizeNotificationInput(notificationInput);

    if (notificationId) {
        const existing = await getNotification(env, Number(notificationId));
        if (!existing) {
            throw httpError(404, "notification not found");
        }

        await env.DB.prepare(
            `UPDATE notification
             SET name = ?, active = ?, user_id = ?, is_default = ?, config = ?
             WHERE id = ?`
        )
            .bind(
                notification.name,
                notification.active ? 1 : 0,
                1,
                notification.isDefault ? 1 : 0,
                notification.config,
                Number(notificationId)
            )
            .run();

        if (notification.applyExisting) {
            await applyNotificationToAllMonitors(env, Number(notificationId));
        }

        return { id: Number(notificationId) };
    }

    const result = await env.DB.prepare(
        `INSERT INTO notification (name, active, user_id, is_default, config)
         VALUES (?, ?, ?, ?, ?)`
    )
        .bind(notification.name, notification.active ? 1 : 0, 1, notification.isDefault ? 1 : 0, notification.config)
        .run();
    const id = Number(result.meta?.last_row_id);

    if (notification.applyExisting) {
        await applyNotificationToAllMonitors(env, id);
    }

    return { id };
}

export async function deleteNotification(env, notificationId) {
    await ensureNotificationTables(env);
    const existing = await getNotification(env, notificationId);
    if (!existing) {
        throw httpError(404, "notification not found");
    }
    await env.DB.prepare("DELETE FROM monitor_notification WHERE notification_id = ?").bind(notificationId).run();
    await env.DB.prepare("DELETE FROM notification WHERE id = ?").bind(notificationId).run();
}

async function testNotification(notificationInput) {
    const notification = normalizeTestNotification(notificationInput);

    if (notification.type === "pushover") {
        await sendPushoverNotification(notification, `${notification.name} Testing`, {
            failureLabel: "test notification",
        });
        return { ok: true, msg: NOTIFICATION_OK_MESSAGE };
    }

    if (notification.type === "teams") {
        await sendTeamsNotification(notification, buildTeamsTestNotificationPayload(`${notification.name} Testing`), {
            failureLabel: "test notification",
        });
        return { ok: true, msg: NOTIFICATION_OK_MESSAGE };
    }

    throw httpError(400, `Notification type "${notification.type}" is not supported by the Worker test sender yet.`);
}

function normalizeTestNotification(notificationInput = {}) {
    if (!notificationInput || typeof notificationInput !== "object" || Array.isArray(notificationInput)) {
        throw httpError(400, "Notification payload is required");
    }

    const type = String(notificationInput.type || "").trim();
    if (!type) {
        throw httpError(400, "Notification type is required");
    }

    const name = String(notificationInput.name || type || "Notification").trim() || "Notification";
    return {
        ...notificationInput,
        type,
        name,
    };
}

async function sendPushoverNotification(notification, msg, options = {}) {
    const heartbeatJSON = options.heartbeatJSON || null;
    const monitorJSON = options.monitorJSON || null;
    const body = new URLSearchParams();
    body.set("message", buildPushoverMessage(msg, heartbeatJSON));
    body.set("user", requiredNotificationValue(notification.pushoveruserkey, "Pushover user key is required"));
    body.set("token", requiredNotificationValue(notification.pushoverapptoken, "Pushover application token is required"));
    body.set("retry", "30");
    body.set("expire", "3600");
    body.set("html", "1");

    appendOptionalNotificationValue(
        body,
        "sound",
        heartbeatJSON?.status === UP && notification.pushoversounds_up
            ? notification.pushoversounds_up
            : notification.pushoversounds
    );
    appendOptionalNotificationValue(body, "priority", notification.pushoverpriority);
    appendOptionalNotificationValue(body, "title", notification.pushovertitle);
    appendOptionalNotificationValue(body, "device", notification.pushoverdevice);
    appendOptionalNotificationValue(body, "ttl", notification.pushoverttl);

    const dashboardUrl = buildMonitorDashboardUrl(options.primaryBaseURL, monitorJSON?.id);
    if (dashboardUrl) {
        body.set("url", dashboardUrl);
        body.set("url_title", "Link to Monitor");
    }

    const response = await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: {
            "content-type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!response.ok) {
        throw httpError(502, `Pushover ${options.failureLabel || "notification"} failed with HTTP ${response.status}`);
    }
}

/**
 * Send a Microsoft Teams card through an Incoming Webhook URL.
 * @param {object} notification Notification settings from the UI.
 * @param {object} payload Teams webhook payload.
 * @param {object} options Send options.
 * @returns {Promise<void>}
 */
async function sendTeamsNotification(notification, payload, options = {}) {
    const webhookUrl = normalizeHttpsNotificationUrl(
        requiredNotificationValue(notification.webhookUrl, "Teams webhook URL is required"),
        "Teams webhook URL must be a valid HTTPS URL"
    );
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw httpError(502, `Teams ${options.failureLabel || "notification"} failed with HTTP ${response.status}`);
    }
}

/**
 * Build the adaptive-card payload accepted by Microsoft Teams incoming webhooks.
 * @param {string} msg Message to include in the test card.
 * @returns {object} Teams webhook payload.
 */
function buildTeamsTestNotificationPayload(msg) {
    return {
        type: "message",
        summary: msg,
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                contentUrl: "",
                content: {
                    type: "AdaptiveCard",
                    body: [
                        {
                            type: "TextBlock",
                            size: "Medium",
                            weight: "Bolder",
                            text: "Uptime Worker test notification",
                        },
                        {
                            type: "FactSet",
                            facts: [
                                {
                                    title: "Description",
                                    value: msg,
                                },
                            ],
                        },
                    ],
                    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                    version: "1.5",
                },
            },
        ],
    };
}

/**
 * Build a Pushover message with heartbeat time details when available.
 * @param {string} msg Base notification message.
 * @param {object|null} heartbeatJSON Serialized heartbeat data.
 * @returns {string} Pushover message body.
 */
function buildPushoverMessage(msg, heartbeatJSON) {
    if (!heartbeatJSON?.localDateTime) {
        return msg;
    }
    return `${msg}\n<b>Time (${heartbeatJSON.timezone || "UTC"})</b>: ${heartbeatJSON.localDateTime}`;
}

/**
 * Build the adaptive-card payload for monitor status notifications.
 * @param {object} monitorJSON Serialized monitor data.
 * @param {object} heartbeatJSON Serialized heartbeat data.
 * @param {object} settings Worker UI settings.
 * @returns {object} Teams webhook payload.
 */
function buildTeamsMonitorNotificationPayload(monitorJSON, heartbeatJSON, settings) {
    const summary = buildTeamsStatusSummary(monitorJSON?.name, heartbeatJSON?.status);
    const facts = [];
    const actions = [];
    const dashboardUrl = buildMonitorDashboardUrl(settings.primaryBaseURL, monitorJSON?.id);
    const monitorUrl = buildMonitorTargetUrl(monitorJSON);

    if (heartbeatJSON?.msg) {
        facts.push({
            title: "Description",
            value: heartbeatJSON.msg,
        });
    }
    if (monitorJSON?.name) {
        facts.push({
            title: "Monitor",
            value: monitorJSON.name,
        });
    }
    if (monitorUrl) {
        facts.push({
            title: "Target",
            value: isHttpUrl(monitorUrl) ? `[${monitorUrl}](${monitorUrl})` : monitorUrl,
        });
    }
    if (heartbeatJSON?.localDateTime) {
        facts.push({
            title: "Time",
            value: `${heartbeatJSON.localDateTime}${heartbeatJSON.timezone ? ` (${heartbeatJSON.timezone})` : ""}`,
        });
    }

    if (dashboardUrl) {
        actions.push({
            type: "Action.OpenUrl",
            title: "Visit Uptime Worker",
            url: dashboardUrl,
        });
    }
    if (isHttpUrl(monitorUrl)) {
        actions.push({
            type: "Action.OpenUrl",
            title: "Visit Monitor URL",
            url: monitorUrl,
        });
    }

    const body = [
        {
            type: "Container",
            verticalContentAlignment: "Center",
            items: [
                {
                    type: "TextBlock",
                    size: "Medium",
                    weight: "Bolder",
                    text: `**${summary}**`,
                },
                {
                    type: "TextBlock",
                    size: "Small",
                    weight: "Default",
                    text: "Uptime Worker Alert",
                    isSubtle: true,
                    spacing: "None",
                },
            ],
            style: heartbeatJSON?.status === DOWN ? "attention" : "good",
        },
        {
            type: "FactSet",
            separator: false,
            facts,
        },
    ];

    if (settings.teamsEnableTags && monitorJSON?.tags?.length > 0) {
        body.push({
            type: "TextBlock",
            size: "Small",
            text: monitorJSON.tags.map(formatTagForNotification).join(", "),
            wrap: true,
        });
    }

    if (actions.length > 0) {
        body.push({
            type: "ActionSet",
            actions,
        });
    }

    return {
        type: "message",
        summary,
        attachments: [
            {
                contentType: "application/vnd.microsoft.card.adaptive",
                contentUrl: "",
                content: {
                    type: "AdaptiveCard",
                    body,
                    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                    version: "1.5",
                },
            },
        ],
    };
}

/**
 * Normalize and validate notification webhook URLs that must use HTTPS.
 * @param {string} value Raw URL from the notification form.
 * @param {string} message Error message for invalid values.
 * @returns {string} Normalized HTTPS URL.
 * @throws {Error} When the value is not a valid HTTPS URL.
 */
function normalizeHttpsNotificationUrl(value, message) {
    let url;
    try {
        url = new URL(value);
    } catch {
        throw httpError(400, message);
    }

    if (url.protocol !== "https:") {
        throw httpError(400, message);
    }

    return url.toString();
}

function requiredNotificationValue(value, message) {
    const normalized = String(value || "").trim();
    if (!normalized) {
        throw httpError(400, message);
    }
    return normalized;
}

function appendOptionalNotificationValue(body, key, value) {
    const normalized = String(value ?? "").trim();
    if (normalized) {
        body.set(key, normalized);
    }
}

async function getNotification(env, notificationId) {
    await ensureNotificationTables(env);
    return await env.DB.prepare(
        `SELECT id, name, active, user_id, is_default, config
         FROM notification
         WHERE id = ?`
    )
        .bind(notificationId)
        .first();
}

async function ensureNotificationTables(env) {
    await env.DB.prepare(NOTIFICATION_TABLE_SQL).run();
    await env.DB.prepare(MONITOR_NOTIFICATION_TABLE_SQL).run();
    await env.DB.prepare(MONITOR_NOTIFICATION_INDEX_SQL).run();
}

function normalizeNotificationInput(notificationInput = {}) {
    const config = {
        ...notificationInput,
        applyExisting: false,
    };
    const name = String(notificationInput.name || notificationInput.type || "Notification").trim();
    return {
        name,
        active: notificationInput.active !== false,
        isDefault: Boolean(notificationInput.isDefault),
        applyExisting: Boolean(notificationInput.applyExisting),
        config: JSON.stringify(config),
    };
}

function serializeNotification(row) {
    return {
        id: Number(row.id),
        name: row.name || "",
        active: row.active === undefined ? true : Boolean(row.active),
        user_id: row.user_id ?? 1,
        isDefault: Boolean(row.is_default),
        config: row.config || "{}",
    };
}

async function applyNotificationToAllMonitors(env, notificationId) {
    const monitors = await env.DB.prepare("SELECT id FROM monitors").all();
    await Promise.all(
        (monitors.results || []).map((monitor) =>
            env.DB.prepare(
                `INSERT INTO monitor_notification (monitor_id, notification_id)
                 SELECT ?, ?
                 WHERE NOT EXISTS (
                    SELECT 1 FROM monitor_notification
                    WHERE monitor_id = ? AND notification_id = ?
                 )`
            )
                .bind(Number(monitor.id), notificationId, Number(monitor.id), notificationId)
                .run()
        )
    );
}

/**
 * Check whether a monitor save request includes notification selections.
 * @param {object} input Monitor save request body.
 * @returns {boolean} True when notification selections were submitted.
 */
function hasMonitorNotificationSelection(input) {
    return Boolean(input && Object.prototype.hasOwnProperty.call(input, "notificationIDList"));
}

/**
 * Convert a submitted notification checkbox map into enabled notification IDs.
 * @param {object} notificationIDList Submitted notification checkbox state.
 * @returns {number[]} Enabled notification IDs.
 */
function normalizeMonitorNotificationIds(notificationIDList) {
    if (!notificationIDList || typeof notificationIDList !== "object" || Array.isArray(notificationIDList)) {
        return [];
    }
    return Object.entries(notificationIDList)
        .filter(([, enabled]) => isMonitorNotificationEnabled(enabled))
        .map(([notificationId]) => Number(notificationId))
        .filter((notificationId) => Number.isInteger(notificationId) && notificationId > 0);
}

function normalizeNotificationIdList(notificationIDList) {
    return normalizeMonitorNotificationIds(notificationIDList);
}

/**
 * Normalize checkbox-style notification enabled values.
 * @param {unknown} value Submitted checkbox value.
 * @returns {boolean} True when the value represents an enabled notification.
 */
function isMonitorNotificationEnabled(value) {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
    }
    return Boolean(value);
}

/**
 * Replace the notification relationships for a monitor.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number} monitorId Monitor ID to update.
 * @param {object} notificationIDList Submitted notification checkbox state.
 * @returns {Promise<void>}
 */
async function updateMonitorNotifications(env, monitorId, notificationIDList) {
    await ensureNotificationTables(env);
    const normalizedMonitorId = Number(monitorId);
    await env.DB.prepare("DELETE FROM monitor_notification WHERE monitor_id = ?").bind(normalizedMonitorId).run();

    const notificationIds = normalizeMonitorNotificationIds(notificationIDList);
    await Promise.all(
        notificationIds.map((notificationId) =>
            env.DB.prepare(
                `INSERT INTO monitor_notification (monitor_id, notification_id)
                 SELECT ?, ?
                 WHERE NOT EXISTS (
                    SELECT 1 FROM monitor_notification
                    WHERE monitor_id = ? AND notification_id = ?
                 )`
            )
                .bind(normalizedMonitorId, notificationId, normalizedMonitorId, notificationId)
                .run()
        )
    );
}

export async function listTags(env) {
    await ensureTagTables(env);
    const result = await env.DB.prepare("SELECT id, name, color FROM tag ORDER BY name").all();
    return (result.results || []).map(serializeTag);
}

export async function saveTag(env, tagInput = {}, tagId = null) {
    await ensureTagTables(env);
    const tag = normalizeTagInput(tagInput);

    if (tagId) {
        const existing = await getTag(env, Number(tagId));
        if (!existing) {
            throw httpError(404, "tagNotFound");
        }
        await env.DB.prepare("UPDATE tag SET name = ?, color = ? WHERE id = ?")
            .bind(tag.name, tag.color, Number(tagId))
            .run();
        return { id: Number(tagId), ...tag };
    }

    const result = await env.DB.prepare("INSERT INTO tag (name, color) VALUES (?, ?)")
        .bind(tag.name, tag.color)
        .run();
    const id = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    return { id, ...tag };
}

export async function deleteTag(env, tagId) {
    await ensureTagTables(env);
    const existing = await getTag(env, tagId);
    if (!existing) {
        throw httpError(404, "tagNotFound");
    }
    await env.DB.prepare("DELETE FROM monitor_tag WHERE tag_id = ?").bind(tagId).run();
    await env.DB.prepare("DELETE FROM tag WHERE id = ?").bind(tagId).run();
}

export async function addMonitorTag(env, monitorId, tagId, value = "") {
    await ensureTagTables(env);
    await assertMonitorAndTagExist(env, monitorId, tagId);
    await env.DB.prepare("INSERT INTO monitor_tag (tag_id, monitor_id, value) VALUES (?, ?, ?)")
        .bind(Number(tagId), monitorId, value == null ? "" : String(value))
        .run();
}

export async function deleteMonitorTag(env, monitorId, tagId, value = "") {
    await ensureTagTables(env);
    await env.DB.prepare("DELETE FROM monitor_tag WHERE tag_id = ? AND monitor_id = ? AND value = ?")
        .bind(Number(tagId), monitorId, value == null ? "" : String(value))
        .run();
}

async function ensureTagTables(env) {
    await env.DB.prepare(TAG_TABLE_SQL).run();
    await env.DB.prepare(MONITOR_TAG_TABLE_SQL).run();
    await env.DB.prepare(MONITOR_TAG_MONITOR_INDEX_SQL).run();
    await env.DB.prepare(MONITOR_TAG_TAG_INDEX_SQL).run();
}

async function getTag(env, tagId) {
    await ensureTagTables(env);
    return await env.DB.prepare("SELECT id, name, color FROM tag WHERE id = ?").bind(tagId).first();
}

async function assertMonitorAndTagExist(env, monitorId, tagId) {
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }
    const tag = await getTag(env, Number(tagId));
    if (!tag) {
        throw httpError(404, "tagNotFound");
    }
}

function normalizeTagInput(tagInput = {}) {
    const name = String(tagInput.name || "").trim();
    if (!name) {
        throw httpError(400, "Tag name is required");
    }
    return {
        name,
        color: String(tagInput.color || ""),
    };
}

function serializeTag(row) {
    return {
        id: Number(row.id),
        name: row.name || "",
        color: row.color || "",
    };
}

/**
 * List monitors and their latest heartbeat for the Worker-hosted web UI.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<object[]>} Monitor rows shaped for the Vue dashboard.
 */
export async function listMonitors(env) {
    const monitors = await listMonitorRows(env);
    const relationshipData = buildMonitorRelationshipData(monitors);
    const monitorIds = monitors.map((monitor) => Number(monitor.id));
    const [tagsByMonitorId, notificationsByMonitorId, heartbeatsByMonitorId] = await Promise.all([
        listTagsByMonitorId(env, monitorIds),
        listMonitorNotificationsByMonitorId(env, monitorIds),
        listLatestHeartbeatsByMonitorId(env, monitorIds),
    ]);

    return monitors.map((monitor) => {
        const latestHeartbeat = heartbeatsByMonitorId.get(Number(monitor.id));
        return serializeMonitor(monitor, latestHeartbeat, relationshipData, tagsByMonitorId, notificationsByMonitorId);
    });
}

/**
 * Load the latest heartbeat for each requested monitor without scanning the
 * entire retained heartbeat history table.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number[]} monitorIds Monitor IDs to hydrate.
 * @returns {Promise<Map<number, object>>} Latest heartbeat rows keyed by monitor ID.
 */
async function listLatestHeartbeatsByMonitorId(env, monitorIds) {
    const ids = [...new Set((monitorIds || []).map((id) => Number(id)).filter(Number.isInteger))];
    const heartbeatsByMonitorId = new Map();
    for (let index = 0; index < ids.length; index += LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE) {
        const chunk = ids.slice(index, index + LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE);
        const result = await env.DB.prepare(
            `WITH requested_monitor_ids(monitor_id) AS (
                VALUES ${chunk.map(() => "(?)").join(", ")}
             )
             SELECT h.id, h.monitor_id, h.status, h.ping, h.msg, h.checked_at
             FROM requested_monitor_ids requested
             INNER JOIN heartbeats h
                 ON h.id = (
                     SELECT latest.id
                     FROM heartbeats latest
                     WHERE latest.monitor_id = requested.monitor_id
                     ORDER BY latest.checked_at DESC, latest.id DESC
                     LIMIT 1
                 )`
        )
            .bind(...chunk)
            .all();
        for (const heartbeat of result.results || []) {
            heartbeatsByMonitorId.set(Number(heartbeat.monitor_id), heartbeat);
        }
    }
    return heartbeatsByMonitorId;
}

/**
 * Build the Worker dashboard bootstrap payload from derived runtime tables.
 * This is the critical-path dashboard read for Worker UI mode.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<object>} Bootstrap payload for the Vue dashboard.
 */
export async function getDashboardBootstrap(env) {
    const monitors = await listMonitorRows(env);
    const relationshipData = buildMonitorRelationshipData(monitors);
    const monitorIds = monitors.map((monitor) => Number(monitor.id));
    const [tagsByMonitorId, notificationsByMonitorId, summariesByMonitorId, latestHeartbeatsByMonitorId] = await Promise.all([
        listTagsByMonitorId(env, monitorIds),
        listMonitorNotificationsByMonitorId(env, monitorIds),
        listRuntimeSummariesByMonitorId(env, monitorIds),
        listLatestHeartbeatsByMonitorId(env, monitorIds),
    ]);
    const heartbeatList = {};
    const avgPingList = {};
    const uptimeList = {};

    const serializedMonitors = monitors.map((monitor) => {
        const monitorId = Number(monitor.id);
        const summary = summariesByMonitorId.get(monitorId);
        const latestHeartbeat = selectLatestHeartbeat(
            summaryToHeartbeat(summary),
            latestHeartbeatsByMonitorId.get(monitorId) || null
        );
        const heartbeats = mergeSerializedHeartbeatRows(
            parseHeartbeatBarJson(summary?.heartbeat_bar_json),
            latestHeartbeat ? serializeHeartbeat(latestHeartbeat, monitor) : null
        );
        if (heartbeats.length > 0) {
            heartbeatList[monitorId] = heartbeats;
        }
        avgPingList[monitorId] = normalizeNullableNumber(summary?.avg_ping);
        uptimeList[`${monitorId}_24`] = normalizeNullableNumber(summary?.uptime_24);
        uptimeList[`${monitorId}_720`] = normalizeNullableNumber(summary?.uptime_720);
        uptimeList[`${monitorId}_1y`] = normalizeNullableNumber(summary?.uptime_1y);
        return serializeMonitor(
            monitor,
            latestHeartbeat,
            relationshipData,
            tagsByMonitorId,
            notificationsByMonitorId
        );
    });

    return {
        generatedAt: formatSqliteDateTime(new Date()),
        monitors: serializedMonitors,
        heartbeatList,
        avgPingList,
        uptimeList,
    };
}

/**
 * Read runtime summaries for dashboard bootstrap without touching raw heartbeats.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number[]} monitorIds Monitor IDs to read.
 * @returns {Promise<Map<number, object>>} Summary rows by monitor ID.
 */
async function listRuntimeSummariesByMonitorId(env, monitorIds) {
    const ids = [...new Set((monitorIds || []).map((id) => Number(id)).filter(Number.isInteger))];
    const summariesByMonitorId = new Map();
    if (ids.length === 0) {
        return summariesByMonitorId;
    }
    await ensureDashboardRuntimeCacheTables(env);

    for (let index = 0; index < ids.length; index += LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE) {
        const chunk = ids.slice(index, index + LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE);
        const result = await env.DB.prepare(
            `SELECT monitor_id, latest_heartbeat_id, status, ping, msg, checked_at,
                    avg_ping, uptime_24, uptime_720, uptime_1y, heartbeat_bar_json
             FROM monitor_runtime_summary
             WHERE monitor_id IN (${chunk.map(() => "?").join(", ")})`
        )
            .bind(...chunk)
            .all();
        for (const summary of result.results || []) {
            summariesByMonitorId.set(Number(summary.monitor_id), summary);
        }
    }

    return summariesByMonitorId;
}

/**
 * Convert a runtime summary row into the heartbeat shape serializeMonitor expects.
 * @param {object|null|undefined} summary Runtime summary row.
 * @returns {object|null} Latest heartbeat row, or null.
 */
function summaryToHeartbeat(summary) {
    if (!summary || summary.checked_at == null || summary.status == null) {
        return null;
    }
    return {
        id: summary.latest_heartbeat_id,
        monitor_id: Number(summary.monitor_id),
        status: Number(summary.status),
        status_is_effective: true,
        ping: summary.ping,
        msg: summary.msg || "",
        checked_at: summary.checked_at,
    };
}

function selectLatestHeartbeat(summaryHeartbeat, indexedHeartbeat) {
    if (!summaryHeartbeat) {
        return indexedHeartbeat || null;
    }
    if (!indexedHeartbeat) {
        return summaryHeartbeat;
    }
    return compareHeartbeatRows(indexedHeartbeat, summaryHeartbeat) > 0 ? indexedHeartbeat : summaryHeartbeat;
}

function compareHeartbeatRows(a, b) {
    const checkedAtCompare = String(a?.checked_at || "").localeCompare(String(b?.checked_at || ""));
    if (checkedAtCompare !== 0) {
        return checkedAtCompare;
    }
    return Number(a?.id || 0) - Number(b?.id || 0);
}

function mergeSerializedHeartbeatRows(heartbeats = [], latestHeartbeat = null) {
    const merged = Array.isArray(heartbeats) ? heartbeats.filter(Boolean).slice() : [];
    if (
        latestHeartbeat &&
        !merged.some((heartbeat) =>
            Number(heartbeat.monitorID) === Number(latestHeartbeat.monitorID) &&
            heartbeat.time === latestHeartbeat.time
        )
    ) {
        merged.push(latestHeartbeat);
    }
    return merged
        .sort((a, b) => String(a?.time || "").localeCompare(String(b?.time || "")))
        .slice(-DASHBOARD_HEARTBEAT_BAR_LIMIT);
}

/**
 * Parse cached heartbeat-bar JSON safely.
 * @param {string|null|undefined} value Stored heartbeat JSON.
 * @returns {object[]} Heartbeat rows.
 */
function parseHeartbeatBarJson(value) {
    if (!value) {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function normalizeNullableNumber(value) {
    if (value == null || value === "") {
        return undefined;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

/**
 * Load monitor notification checkbox maps for the supplied monitors.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number[]} monitorIds Monitor IDs to hydrate.
 * @returns {Promise<Map<number, object>>} Notification checkbox maps keyed by monitor ID.
 */
async function listMonitorNotificationsByMonitorId(env, monitorIds) {
    await ensureNotificationTables(env);
    const ids = [...new Set((monitorIds || []).map((id) => Number(id)).filter(Number.isInteger))];
    if (ids.length === 0) {
        return new Map();
    }

    const placeholders = ids.map(() => "?").join(", ");
    const result = await env.DB.prepare(
        `SELECT monitor_id, notification_id
         FROM monitor_notification
         WHERE monitor_id IN (${placeholders})`
    )
        .bind(...ids)
        .all();
    const notificationsByMonitorId = new Map();
    for (const row of result.results || []) {
        const monitorId = Number(row.monitor_id);
        if (!notificationsByMonitorId.has(monitorId)) {
            notificationsByMonitorId.set(monitorId, {});
        }
        notificationsByMonitorId.get(monitorId)[Number(row.notification_id)] = true;
    }
    return notificationsByMonitorId;
}

async function listTagsByMonitorId(env, monitorIds) {
    await ensureTagTables(env);
    const ids = [...new Set((monitorIds || []).map((id) => Number(id)).filter(Number.isInteger))];
    if (ids.length === 0) {
        return new Map();
    }

    const placeholders = ids.map(() => "?").join(", ");
    const result = await env.DB.prepare(
        `SELECT mt.id, mt.monitor_id, mt.tag_id, mt.value, tag.name, tag.color
         FROM monitor_tag mt
         JOIN tag ON mt.tag_id = tag.id
         WHERE mt.monitor_id IN (${placeholders})
         ORDER BY tag.name`
    )
        .bind(...ids)
        .all();
    const tagsByMonitorId = new Map();
    for (const row of result.results || []) {
        const monitorId = Number(row.monitor_id);
        if (!tagsByMonitorId.has(monitorId)) {
            tagsByMonitorId.set(monitorId, []);
        }
        tagsByMonitorId.get(monitorId).push({
            id: Number(row.id),
            monitor_id: monitorId,
            tag_id: Number(row.tag_id),
            value: row.value ?? "",
            name: row.name || "",
            color: row.color || "",
        });
    }
    return tagsByMonitorId;
}

async function listMonitorRows(env) {
    await ensureProxyTables(env);
    try {
        const monitorResult = await env.DB.prepare(
            `SELECT id, name, type, url, hostname, port, method, headers, body, keyword,
                    invert_keyword, json_path, expected_value, timeout, "interval",
                    active, network_profile_id, parent, config_json, proxy_id
             FROM monitors
             ORDER BY name`
        ).all();
        return monitorResult.results || [];
    } catch (error) {
        if (!MISSING_CONFIG_JSON_COLUMN.test(error.message || "") && !MISSING_PARENT_COLUMN.test(error.message || "")) {
            throw error;
        }
        return await listMonitorRowsWithLegacyColumns(env);
    }
}

async function listMonitorRowsWithLegacyColumns(env) {
    const missingConfigJson = await isMissingColumn(env, "monitors", "config_json");
    const missingParent = await isMissingColumn(env, "monitors", "parent");
    const optionalColumns = [
        missingParent ? "NULL AS parent" : "parent",
        missingConfigJson ? "NULL AS config_json" : "config_json",
        "proxy_id",
    ];
    const monitorResult = await env.DB.prepare(
        `SELECT id, name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id, ${optionalColumns.join(", ")}
         FROM monitors
         ORDER BY name`
    ).all();
    return monitorResult.results || [];
}

export async function listStatusPages(env) {
    const config = await getWorkerStatusPageConfig(env);
    return {
        1: config,
    };
}

export async function getStatusPageData(env, slug) {
    const config = await getWorkerStatusPageConfig(env);
    assertWorkerStatusPageSlug(slug, config);
    const monitors = await listMonitors(env);
    return {
        config,
        incidents: [],
        publicGroupList: await getWorkerPublicGroupList(env, monitors),
        maintenanceList: [],
    };
}

export async function getStatusPageHeartbeatData(env, slug) {
    const config = await getWorkerStatusPageConfig(env);
    assertWorkerStatusPageSlug(slug, config);
    const monitors = await listMonitors(env);
    const monitorsById = new Map(monitors.map((monitor) => [Number(monitor.id), monitor]));
    const publicGroupList = await getWorkerPublicGroupList(env, monitors);
    const selectedMonitors = publicGroupList
        .flatMap((group) => group.monitorList || [])
        .map((publicMonitor) => monitorsById.get(Number(publicMonitor.id)))
        .filter(Boolean);

    // Hydrate every selected leaf monitor (including group children) with two
    // batched D1 reads instead of separate history/uptime queries per monitor.
    const leafIdsByGroupId = new Map();
    const leafIds = new Set();
    for (const monitor of selectedMonitors) {
        if (monitor.type === "group") {
            const childIds = getActiveWorkerLeafMonitors(monitor, monitorsById).map((child) => Number(child.id));
            leafIdsByGroupId.set(Number(monitor.id), childIds);
            childIds.forEach((childId) => leafIds.add(childId));
        } else {
            leafIds.add(Number(monitor.id));
        }
    }

    const [heartbeatsByMonitorId, summariesByMonitorId] = await Promise.all([
        listRecentHeartbeatsByMonitorId(env, [...leafIds], STATUS_PAGE_HEARTBEAT_LIMIT),
        listRuntimeSummariesByMonitorId(env, [...leafIds]),
    ]);

    const leafHeartbeatData = (monitorId) => {
        const heartbeats = heartbeatsByMonitorId[monitorId] || [];
        const summaryUptime = summariesByMonitorId.get(monitorId)?.uptime_24;
        return {
            heartbeats,
            uptime: summaryUptime == null ? calculateStatusPageUptime(heartbeats) : Number(summaryUptime),
        };
    };

    const heartbeatList = {};
    const uptimeList = {};
    for (const monitor of selectedMonitors) {
        const monitorId = Number(monitor.id);
        if (monitor.type === "group") {
            const childData = (leafIdsByGroupId.get(monitorId) || []).map(leafHeartbeatData);
            if (childData.length === 0) {
                heartbeatList[monitorId] = [];
                uptimeList[`${monitorId}_24`] = 0;
                continue;
            }
            heartbeatList[monitorId] = buildWorkerGroupHeartbeatList(
                monitorId,
                childData.map((data) => data.heartbeats)
            );
            uptimeList[`${monitorId}_24`] =
                childData.reduce((total, data) => total + data.uptime, 0) / childData.length;
            continue;
        }

        const data = leafHeartbeatData(monitorId);
        heartbeatList[monitorId] = data.heartbeats;
        uptimeList[`${monitorId}_24`] = data.uptime;
    }

    return {
        heartbeatList,
        uptimeList,
    };
}

export async function saveStatusPageData(env, slug, input) {
    const currentConfig = await getWorkerStatusPageConfig(env);
    assertWorkerStatusPageSlug(slug, currentConfig);
    const providedConfig = input?.config && typeof input.config === "object" ? input.config : {};
    const configInput = {
        ...currentConfig,
        ...providedConfig,
    };
    configInput.slug = assertWorkerStatusPageInputSlug(configInput.slug);
    if (typeof input?.imgDataUrl === "string" && input.imgDataUrl.trim()) {
        configInput.icon = input.imgDataUrl;
    }

    const config = normalizeWorkerStatusPageConfig(configInput);
    const publicGroupList = normalizeWorkerPublicGroupList(input?.publicGroupList);
    await setStoredSetting(env, WORKER_STATUS_PAGE_CONFIG_SETTING, config);
    await setStoredSetting(env, WORKER_STATUS_PAGE_PUBLIC_GROUP_LIST_SETTING, publicGroupList);

    const monitors = await listMonitors(env);
    return {
        ok: true,
        msg: "Saved.",
        msgi18n: true,
        config,
        publicGroupList: hydrateWorkerPublicGroupList(publicGroupList, monitors),
    };
}

export async function getSerializedMonitor(env, monitorId) {
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        return null;
    }
    const heartbeat = await env.DB.prepare(
        `SELECT monitor_id, status, ping, msg, checked_at
         FROM heartbeats
         WHERE monitor_id = ?
         ORDER BY checked_at DESC
         LIMIT 1`
    )
        .bind(monitorId)
        .first();
    const rows = await listMonitorRows(env);
    const [tagsByMonitorId, notificationsByMonitorId] = await Promise.all([
        listTagsByMonitorId(env, [monitorId]),
        listMonitorNotificationsByMonitorId(env, [monitorId]),
    ]);
    return serializeMonitor(monitor, heartbeat, buildMonitorRelationshipData(rows), tagsByMonitorId, notificationsByMonitorId);
}

export async function createMonitor(env, monitorInput) {
    await ensureProxyTables(env);
    const monitor = normalizeMonitorInput(monitorInput);
    if (!hasProxySelection(monitorInput) && monitor.proxyId == null) {
        monitor.proxyId = await getDefaultProxyId(env);
    }
    let result;
    try {
        result = await env.DB.prepare(
            `INSERT INTO monitors (
                name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id, parent, config_json, proxy_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(...monitorValues(monitor, true), monitorConfigJson(monitorInput, {}, monitor), monitor.proxyId)
            .run();
    } catch (error) {
        if (!MISSING_PARENT_COLUMN.test(error.message || "") || monitor.parent != null) {
            throw error;
        }
        result = await env.DB.prepare(
            `INSERT INTO monitors (
                name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id, config_json, proxy_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(...monitorValues(monitor, true, false), monitorConfigJson(monitorInput, {}, monitor), monitor.proxyId)
            .run();
    }
    const monitorId = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    if (hasMonitorNotificationSelection(monitorInput)) {
        await updateMonitorNotifications(env, monitorId, monitorInput.notificationIDList);
    }
    return monitorId;
}

/**
 * Import monitors from an Uptime Kuma backup payload into the Worker D1 store.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {object|object[]} importInput Import request body or monitor array.
 * @returns {Promise<object>} Import summary with one result per imported or derived monitor.
 */
export async function importMonitors(env, importInput = {}) {
    const sourceMonitors = extractImportMonitors(importInput);
    const importHandle = normalizeImportHandle(importInput.importHandle || importInput.mode);
    await ensureMonitorParentColumn(env);
    const privateNetworkProfileId = await getImportPrivateNetworkProfileId(env);
    const existingRows = await listMonitorRows(env);
    const existingRelationshipData = buildMonitorRelationshipData(existingRows);
    const existingByName = new Map(existingRows.map((monitor) => [monitor.name, monitor]));
    const existingGroupByPath = buildExistingGroupPathIndex(existingRows, existingRelationshipData);
    const monitors = expandImportMonitorsWithMissingGroups(sourceMonitors);
    const importedIdBySourceId = new Map();
    const pendingParents = [];
    const results = [];
    let imported = 0;
    let skipped = 0;
    let unsupported = 0;
    let overwritten = 0;
    let failed = 0;

    for (const sourceMonitor of sortImportMonitorsByParent(monitors)) {
        const name = String(sourceMonitor?.name || "").trim();
        const type = sourceMonitor?.type;
        const result = { name, type };

        if (!WORKER_MONITOR_TYPES.has(type)) {
            unsupported++;
            results.push({
                ...result,
                status: "unsupported",
                reason: `Unsupported monitor type: ${type || "unknown"}`,
            });
            continue;
        }

        if (!name) {
            failed++;
            results.push({
                ...result,
                status: "failed",
                reason: "Monitor name is required",
            });
            continue;
        }

        const existing = findExistingImportMonitor(sourceMonitor, existingByName, existingGroupByPath);
        if (existing && importHandle === "skip") {
            skipped++;
            rememberImportedSourceId(importedIdBySourceId, sourceMonitor, Number(existing.id));
            results.push({
                ...result,
                status: "skipped",
                reason: "Monitor already exists",
                monitorID: Number(existing.id),
            });
            continue;
        }

        try {
            if (existing && importHandle === "overwrite") {
                await deleteMonitor(env, Number(existing.id));
                removeExistingImportMonitor(existing, sourceMonitor, existingByName, existingGroupByPath);
                overwritten++;
            }

            const normalizedMonitor = normalizeImportedMonitor(sourceMonitor, { privateNetworkProfileId });
            const sourceParent = normalizeImportSourceReference(sourceMonitor.parent);
            if (sourceParent != null) {
                normalizedMonitor.parent = importedIdBySourceId.get(sourceParent) || null;
            }
            const monitorID = await createMonitor(env, normalizedMonitor);
            rememberImportedSourceId(importedIdBySourceId, sourceMonitor, monitorID);
            const importedMonitor = {
                ...result,
                status: "imported",
                monitorID,
            };
            if (sourceParent != null && !normalizedMonitor.parent) {
                pendingParents.push({ monitorID, sourceParent, result: importedMonitor });
            }
            imported++;
            rememberExistingImportMonitor(
                existingByName,
                existingGroupByPath,
                sourceMonitor,
                { id: monitorID, name, type, parent: normalizedMonitor.parent }
            );
            results.push(importedMonitor);
        } catch (error) {
            failed++;
            results.push({
                ...result,
                status: "failed",
                reason: error.message,
            });
        }
    }

    for (const pendingParent of pendingParents) {
        const parent = importedIdBySourceId.get(pendingParent.sourceParent);
        if (parent) {
            await updateMonitorParent(env, pendingParent.monitorID, parent);
        } else {
            pendingParent.result.reason = `Parent monitor ${pendingParent.sourceParent} was not found; imported at top level`;
        }
    }

    return {
        ok: failed === 0,
        msg: monitorImportMessage({ imported, skipped, unsupported, failed }),
        total: monitors.length,
        imported,
        skipped,
        unsupported,
        overwritten,
        failed,
        results,
    };
}

/**
 * Build a user-facing import summary message.
 * @param {object} summary Import counters.
 * @returns {string} Summary sentence.
 */
function monitorImportMessage(summary) {
    const parts = [
        `Imported ${summary.imported} monitor${summary.imported === 1 ? "" : "s"}`,
    ];
    if (summary.skipped) {
        parts.push(`skipped ${summary.skipped}`);
    }
    if (summary.unsupported) {
        parts.push(`unsupported ${summary.unsupported}`);
    }
    if (summary.failed) {
        parts.push(`failed ${summary.failed}`);
    }
    return `${parts.join(", ")}.`;
}

export async function updateMonitor(env, monitorId, monitorInput) {
    await ensureProxyTables(env);
    const existing = await getMonitor(env, monitorId);
    if (!existing) {
        throw httpError(404, "Monitor not found");
    }
    const monitor = normalizeMonitorInput(monitorInput, existing);
    try {
        await env.DB.prepare(
            `UPDATE monitors SET
                name = ?, type = ?, url = ?, hostname = ?, port = ?, method = ?,
                headers = ?, body = ?, keyword = ?, invert_keyword = ?,
                json_path = ?, expected_value = ?, timeout = ?, "interval" = ?,
                network_profile_id = ?, parent = ?, config_json = ?, proxy_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(...monitorValues(monitor, false), monitorConfigJson(monitorInput, existing, monitor), monitor.proxyId, monitorId)
            .run();
    } catch (error) {
        if (!MISSING_PARENT_COLUMN.test(error.message || "") || monitor.parent != null) {
            throw error;
        }
        await env.DB.prepare(
            `UPDATE monitors SET
                name = ?, type = ?, url = ?, hostname = ?, port = ?, method = ?,
                headers = ?, body = ?, keyword = ?, invert_keyword = ?,
                json_path = ?, expected_value = ?, timeout = ?, "interval" = ?,
                network_profile_id = ?, config_json = ?, proxy_id = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(...monitorValues(monitor, false, false), monitorConfigJson(monitorInput, existing, monitor), monitor.proxyId, monitorId)
            .run();
    }
    if (hasMonitorNotificationSelection(monitorInput)) {
        await updateMonitorNotifications(env, monitorId, monitorInput.notificationIDList);
    }
}

export async function setMonitorActive(env, monitorId, active) {
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }
    await env.DB.prepare("UPDATE monitors SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(active ? 1 : 0, monitorId)
        .run();
}

export async function deleteMonitor(env, monitorId) {
    await ensureTagTables(env);
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }
    await clearMonitorHeartbeats(env, monitorId);
    await env.DB.prepare("DELETE FROM monitor_tag WHERE monitor_id = ?").bind(monitorId).run();
    await updateDeletedMonitorChildren(env, monitorId);
    await env.DB.prepare("DELETE FROM monitors WHERE id = ?")
        .bind(monitorId)
        .run();
}

/**
 * List heartbeat rows for a Worker monitor.
 * @param {object} env Worker environment bindings.
 * @param {number} monitorId Monitor ID.
 * @param {number} offset Pagination offset.
 * @param {number} count Page size.
 * @param {object} options Listing options.
 * @returns {Promise<object>} Count and heartbeat rows.
 */
export async function listMonitorHeartbeats(env, monitorId, offset = 0, count = 100, options = {}) {
    const monitor = await getMonitor(env, monitorId);
    if (options.importantOnly) {
        return await listImportantMonitorHeartbeats(env, monitorId, monitor, offset, count);
    }

    const total = await env.DB.prepare("SELECT COUNT(*) AS count FROM heartbeats WHERE monitor_id = ?")
        .bind(monitorId)
        .first();
    const result = await env.DB.prepare(
        `SELECT monitor_id, status, ping, msg, checked_at
         FROM heartbeats
         WHERE monitor_id = ?
         ORDER BY checked_at DESC
         LIMIT ? OFFSET ?`
    )
        .bind(monitorId, Math.max(1, Math.min(500, count)), Math.max(0, offset))
        .all();
    return {
        count: Number(total?.count || 0),
        heartbeats: (result.results || []).map((heartbeat) => serializeHeartbeat(heartbeat, monitor)),
    };
}

/**
 * List recent heartbeat histories for several Worker monitors in one D1 query.
 * @param {object} env Worker environment bindings.
 * @param {number[]} monitorIds Monitor IDs to hydrate.
 * @param {number} count Max heartbeat rows per monitor.
 * @returns {Promise<object>} Heartbeat rows keyed by monitor ID.
 */
export async function listRecentHeartbeatsByMonitorId(
    env,
    monitorIds = [],
    count = DEFAULT_RECENT_HEARTBEAT_HISTORY_LIMIT
) {
    const ids = normalizeRecentHeartbeatMonitorIds(monitorIds);
    const limit = normalizeRecentHeartbeatHistoryLimit(count);
    if (ids.length === 0) {
        return {};
    }

    const monitors = await listMonitorRows(env);
    const monitorsById = new Map(monitors.map((monitor) => [Number(monitor.id), monitor]));
    const existingIds = ids.filter((monitorId) => monitorsById.has(monitorId));
    const heartbeatsByMonitorId = Object.fromEntries(existingIds.map((monitorId) => [monitorId, []]));

    for (let index = 0; index < existingIds.length; index += LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE) {
        const chunk = existingIds.slice(index, index + LATEST_HEARTBEAT_LOOKUP_CHUNK_SIZE);
        const result = await env.DB.prepare(
            `WITH requested_monitor_ids(monitor_id) AS (
                VALUES ${chunk.map(() => "(?)").join(", ")}
             ),
             ranked_heartbeats AS (
                SELECT h.id, h.monitor_id, h.status, h.ping, h.msg, h.checked_at,
                       ROW_NUMBER() OVER (
                           PARTITION BY h.monitor_id
                           ORDER BY h.checked_at DESC, h.id DESC
                       ) AS recent_rank
                FROM heartbeats h
                INNER JOIN requested_monitor_ids requested
                    ON requested.monitor_id = h.monitor_id
             )
             SELECT id, monitor_id, status, ping, msg, checked_at
             FROM ranked_heartbeats
             WHERE recent_rank <= ?
             ORDER BY monitor_id, checked_at ASC, id ASC`
        )
            .bind(...chunk, limit)
            .all();

        for (const heartbeat of result.results || []) {
            const monitorId = Number(heartbeat.monitor_id);
            heartbeatsByMonitorId[monitorId].push(serializeHeartbeat(heartbeat, monitorsById.get(monitorId)));
        }
    }

    return heartbeatsByMonitorId;
}

/**
 * Normalize dashboard heartbeat history monitor IDs.
 * @param {unknown} monitorIds Submitted monitor IDs.
 * @returns {number[]} Unique positive integer monitor IDs.
 */
function normalizeRecentHeartbeatMonitorIds(monitorIds) {
    if (!Array.isArray(monitorIds)) {
        return [];
    }
    return [...new Set(
        monitorIds
            .map((monitorId) => Number(monitorId))
            .filter((monitorId) => Number.isInteger(monitorId) && monitorId > 0)
    )];
}

/**
 * Normalize dashboard heartbeat history page size.
 * @param {unknown} count Submitted row limit.
 * @returns {number} Bounded row limit per monitor.
 */
function normalizeRecentHeartbeatHistoryLimit(count) {
    const parsed = Number(count);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_RECENT_HEARTBEAT_HISTORY_LIMIT;
    }
    return Math.max(1, Math.min(MAX_RECENT_HEARTBEAT_HISTORY_LIMIT, Math.round(parsed)));
}

/**
 * List heartbeat rows across Worker monitors.
 * @param {object} env Worker environment bindings.
 * @param {number} offset Pagination offset.
 * @param {number} count Page size.
 * @param {object} options Listing options.
 * @returns {Promise<object>} Count and heartbeat rows.
 */
export async function listHeartbeats(env, offset = 0, count = 100, options = {}) {
    if (options.importantOnly) {
        return await listImportantHeartbeats(env, offset, count);
    }
    throw httpError(400, "Only important heartbeat listing is supported");
}

/**
 * List important heartbeat rows across all active Worker monitors.
 * @param {object} env Worker environment bindings.
 * @param {number} offset Pagination offset.
 * @param {number} count Page size.
 * @returns {Promise<object>} Count and important heartbeat rows.
 */
export async function listImportantHeartbeats(env, offset = 0, count = 100) {
    return await queryImportantHeartbeatEvents(env, {
        offset,
        count,
    });
}

/**
 * List only Worker monitor heartbeats that should appear in the event log.
 * @param {object} env Worker environment bindings.
 * @param {number} monitorId Monitor ID.
 * @param {object|null} monitor Monitor row.
 * @param {number} offset Pagination offset.
 * @param {number} count Page size.
 * @returns {Promise<object>} Count and important heartbeat rows.
 */
async function listImportantMonitorHeartbeats(env, monitorId, monitor, offset = 0, count = 100) {
    if (monitor && !monitor.active) {
        return {
            count: 0,
            heartbeats: [],
        };
    }

    return await queryImportantHeartbeatEvents(env, {
        monitorId,
        offset,
        count,
    });
}

/**
 * List precomputed event-log rows. The dashboard no longer computes important
 * transitions from raw heartbeats on the read path.
 * @param {object} env Worker environment bindings.
 * @param {object} options Query options.
 * @param {number|null} options.monitorId Optional monitor ID filter.
 * @param {number} options.offset Pagination offset.
 * @param {number} options.count Page size.
 * @returns {Promise<object>} Count and important heartbeat rows.
 */
async function queryImportantHeartbeatEvents(env, {
    monitorId = null,
    offset = 0,
    count = 100,
} = {}) {
    const result = await queryMonitorEventLog(env, { monitorId, offset, count });

    if (result.count > 0 || offset > 0) {
        return result;
    }

    if (!await eventLogNeedsBackfill(env, monitorId)) {
        return result;
    }

    await backfillDashboardRuntimeCaches(env, {
        monitorId,
        limit: monitorId == null ? DASHBOARD_BACKFILL_MONITOR_LIMIT : 1,
        force: true,
    });
    return await queryMonitorEventLog(env, { monitorId, offset, count });
}

async function queryMonitorEventLog(env, {
    monitorId = null,
    offset = 0,
    count = 100,
} = {}) {
    await ensureDashboardRuntimeCacheTables(env);
    const limit = Math.max(1, Math.min(500, Number(count) || 100));
    const start = Math.max(0, Number(offset) || 0);
    const monitorFilter = monitorId == null ? "" : "AND e.monitor_id = ?";
    const values = monitorId == null ? [limit, start] : [Number(monitorId), limit, start, Number(monitorId)];
    const result = await env.DB.prepare(
        `WITH event_page AS (
            SELECT e.id, e.heartbeat_id, e.monitor_id, e.status, e.ping, e.msg, e.checked_at
            FROM monitor_event_log e
            INNER JOIN monitors m ON m.id = e.monitor_id
            WHERE m.active = 1
            ${monitorFilter}
            ORDER BY e.checked_at DESC, e.id DESC
            LIMIT ? OFFSET ?
        )
        SELECT
            total.total_count,
            event_page.id,
            event_page.heartbeat_id,
            event_page.monitor_id,
            event_page.status,
            event_page.ping,
            event_page.msg,
            event_page.checked_at
        FROM (
            SELECT COUNT(*) AS total_count
            FROM monitor_event_log e
            INNER JOIN monitors m ON m.id = e.monitor_id
            WHERE m.active = 1
            ${monitorFilter}
        ) total
        LEFT JOIN event_page ON 1 = 1`
    )
        .bind(...values)
        .all();
    const rows = result.results || [];
    const countRow = rows[0];
    return {
        count: Number(countRow?.total_count || 0),
        heartbeats: rows
            .filter((heartbeat) => heartbeat.monitor_id != null)
            .map((heartbeat) => serializeHeartbeat(heartbeat)),
    };
}

async function eventLogNeedsBackfill(env, monitorId) {
    if (monitorId != null) {
        return !await hasRuntimeSummaryForMonitor(env, Number(monitorId));
    }

    const monitors = await listMonitorRows(env);
    const activeMonitorIds = monitors
        .filter((monitor) => Number(monitor.active ?? 1) === 1)
        .map((monitor) => Number(monitor.id));
    if (activeMonitorIds.length === 0) {
        return false;
    }
    const summariesByMonitorId = await listRuntimeSummariesByMonitorId(env, activeMonitorIds);
    return summariesByMonitorId.size < activeMonitorIds.length;
}

/**
 * Return chart datapoints from precomputed metric buckets.
 * @param {object} env Worker environment bindings.
 * @param {number} monitorId Monitor ID.
 * @param {number} periodHours Requested chart period.
 * @returns {Promise<object[]>} Chart datapoints.
 */
export async function getMonitorChartData(env, monitorId, periodHours = DEFAULT_DASHBOARD_CHART_PERIOD_HOURS) {
    const period = normalizeDashboardChartPeriod(periodHours);
    const resolution = period <= 24 ? 60 : 3600;
    const since = formatSqliteDateTime(new Date(Date.now() - period * 60 * 60 * 1000));
    let rows = await listMonitorMetricBuckets(env, monitorId, resolution, since);
    if (rows.length === 0 && resolution !== 60) {
        rows = await listMetricRollupRows(env, resolution, {
            monitorId,
            since,
        });
    }

    if (rows.length === 0 && !await hasRuntimeSummaryForMonitor(env, monitorId)) {
        await backfillDashboardRuntimeCaches(env, {
            monitorId,
            limit: 1,
            force: true,
        });
        rows = await listMonitorMetricBuckets(env, monitorId, resolution, since);
    }

    return rows.map((row) => {
        const up = Number(row.up_count || 0);
        const timestamp = Math.floor(parseSqliteDateTime(row.bucket_start) / 1000);
        return {
            timestamp,
            up,
            down: Number(row.down_count || 0) + Number(row.pending_count || 0),
            maintenance: Number(row.maintenance_count || 0),
            avgPing: up > 0 ? Number(row.ping_sum || 0) / up : null,
            minPing: row.min_ping == null ? null : Number(row.min_ping),
            maxPing: row.max_ping == null ? null : Number(row.max_ping),
        };
    });
}

function normalizeDashboardChartPeriod(periodHours) {
    const period = Number(periodHours);
    if (DASHBOARD_CHART_PERIODS.has(period)) {
        return period;
    }
    return DEFAULT_DASHBOARD_CHART_PERIOD_HOURS;
}

async function listMonitorMetricBuckets(env, monitorId, resolutionSeconds, since) {
    await ensureDashboardRuntimeCacheTables(env);
    const result = await env.DB.prepare(
        `SELECT monitor_id, resolution_seconds, bucket_start, up_count, down_count,
                pending_count, maintenance_count, total_count, ping_sum, min_ping, max_ping
         FROM monitor_metric_bucket
         WHERE monitor_id = ?
           AND resolution_seconds = ?
           AND bucket_start >= ?
         ORDER BY bucket_start ASC`
    )
        .bind(Number(monitorId), Number(resolutionSeconds), since)
        .all();
    return result.results || [];
}

async function hasRuntimeSummaryForMonitor(env, monitorId) {
    return (await listRuntimeSummariesByMonitorId(env, [Number(monitorId)])).has(Number(monitorId));
}

/**
 * Rebuild missing derived dashboard rows in bounded batches. This keeps old D1
 * data usable without blocking every dashboard read on a full migration.
 * @param {object} env Worker environment bindings.
 * @param {object} options Backfill options.
 * @param {number|null} options.monitorId Optional single monitor ID.
 * @param {number} options.limit Max monitors to rebuild.
 * @returns {Promise<object>} Backfill result.
 */
export async function backfillDashboardRuntimeCaches(env, options = {}) {
    const limit = Math.max(1, Math.min(100, Number(options.limit) || DASHBOARD_BACKFILL_MONITOR_LIMIT));
    let monitors;
    if (options.monitorId != null) {
        const monitor = await getMonitor(env, Number(options.monitorId));
        monitors = monitor ? [monitor] : [];
    } else {
        monitors = await listMonitorRows(env);
    }

    const monitorIds = monitors.map((monitor) => Number(monitor.id));
    const summariesByMonitorId = await listRuntimeSummariesByMonitorId(env, monitorIds);
    const missing = monitors
        .filter((monitor) => options.force || !summariesByMonitorId.has(Number(monitor.id)))
        .slice(0, limit);

    for (const monitor of missing) {
        await rebuildMonitorRuntimeCache(env, monitor);
    }

    return {
        rebuilt: missing.length,
    };
}

export async function refreshDashboardRuntimeSummaries(env, options = {}) {
    const limit = Math.max(1, Math.min(100, Number(options.limit) || DASHBOARD_BACKFILL_MONITOR_LIMIT));
    const now = options.now instanceof Date ? options.now : new Date();
    const monitors = options.monitorId != null
        ? [await getMonitor(env, Number(options.monitorId))].filter(Boolean)
        : selectScheduledMonitorRefreshWindow(
            (await listMonitorRows(env)).filter((monitor) => Number(monitor.active ?? 1) === 1),
            limit,
            now
        );

    for (const monitor of monitors) {
        await refreshMonitorRuntimeSummary(env, monitor, null, { recomputeExpensive: true });
    }

    return { refreshed: monitors.length };
}

function selectScheduledMonitorRefreshWindow(monitors, limit, now) {
    if (monitors.length <= limit) {
        return monitors;
    }
    const windowIndex = Math.floor(now.getTime() / SCHEDULED_BACKFILL_INTERVAL_MS);
    const offset = (windowIndex * limit) % monitors.length;
    return monitors.slice(offset, offset + limit)
        .concat(monitors.slice(0, Math.max(0, offset + limit - monitors.length)));
}

export async function runScheduledMaintenance(controller, env) {
    const now = resolveScheduledNow(controller);
    const enqueue = await enqueueDueMonitors(env, now);
    const result = {
        ...enqueue,
        backfill: null,
        summaryRefresh: null,
        purge: null,
        twingate: null,
        rollupHourly: null,
        rollupDaily: null,
    };

    if (shouldRunScheduledCadence(now, SCHEDULED_BACKFILL_INTERVAL_MS)) {
        result.backfill = await backfillDashboardRuntimeCaches(env);
        result.rollupHourly = await rollupDashboardMetricBuckets(env, {
            resolutions: [3600],
            since: formatSqliteDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
        });
        result.summaryRefresh = await refreshDashboardRuntimeSummaries(env, { now });
    }

    if (shouldRunScheduledCadence(now, SCHEDULED_PURGE_INTERVAL_MS)) {
        result.purge = await purgeOldMonitorHistory(env, now);
        result.rollupDaily = await rollupDashboardMetricBuckets(env, {
            resolutions: [86400],
            since: formatSqliteDateTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
        });
    }

    if (shouldRunScheduledCadence(now, SCHEDULED_TWINGATE_ALERT_INTERVAL_MS)) {
        result.twingate = await checkTwingateHealthAlert(env, now);
    }

    return result;
}

function resolveScheduledNow(controller = {}) {
    const scheduledTime = Number(controller?.scheduledTime);
    if (Number.isFinite(scheduledTime) && scheduledTime > 0) {
        return new Date(scheduledTime);
    }
    return new Date();
}

function shouldRunScheduledCadence(now, intervalMs) {
    const intervalMinutes = Math.max(1, Math.floor(intervalMs / 60000));
    const minutesSinceEpoch = Math.floor(now.getTime() / 60000);
    return minutesSinceEpoch % intervalMinutes === 0;
}

async function rebuildMonitorRuntimeCache(env, monitor) {
    if (!monitor || monitor.id == null) {
        return;
    }

    await clearDashboardDerivedDataForMonitor(env, Number(monitor.id));
    const result = await env.DB.prepare(
        `SELECT id, monitor_id, status, ping, msg, checked_at
         FROM heartbeats
         WHERE monitor_id = ?
         ORDER BY checked_at ASC, id ASC
         LIMIT ?`
    )
        .bind(Number(monitor.id), DASHBOARD_BACKFILL_HEARTBEAT_LIMIT)
        .all();
    let previousHeartbeat = null;
    for (const heartbeat of result.results || []) {
        await upsertDashboardMetricBuckets(env, monitor, heartbeat, {
            resolutions: DASHBOARD_METRIC_RESOLUTIONS,
        });
        await upsertDashboardEventLog(env, monitor, heartbeat, previousHeartbeat);
        previousHeartbeat = heartbeat;
    }
    await refreshMonitorRuntimeSummary(env, monitor, null, { recomputeExpensive: true });
}

async function clearDashboardDerivedDataForMonitor(env, monitorId) {
    await ensureDashboardRuntimeCacheTables(env);
    await env.DB.prepare("DELETE FROM monitor_runtime_summary WHERE monitor_id = ?")
        .bind(Number(monitorId))
        .run();
    await env.DB.prepare("DELETE FROM monitor_event_log WHERE monitor_id = ?")
        .bind(Number(monitorId))
        .run();
    await env.DB.prepare("DELETE FROM monitor_metric_bucket WHERE monitor_id = ?")
        .bind(Number(monitorId))
        .run();
}

export async function clearMonitorHeartbeats(env, monitorId) {
    await env.DB.prepare("DELETE FROM heartbeats WHERE monitor_id = ?")
        .bind(monitorId)
        .run();
    await clearDashboardDerivedDataForMonitor(env, monitorId);
}

/**
 * Clear all stored Worker heartbeat/statistics rows.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<void>} Completion promise.
 */
export async function clearAllStatistics(env) {
    await ensureDashboardRuntimeCacheTables(env);
    await env.DB.prepare("DELETE FROM heartbeats").run();
    await env.DB.prepare("DELETE FROM monitor_runtime_summary").run();
    await env.DB.prepare("DELETE FROM monitor_event_log").run();
    await env.DB.prepare("DELETE FROM monitor_metric_bucket").run();
}

/**
 * Delete heartbeat rows older than the saved retention period.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {Date} now Current time for cutoff calculation.
 * @returns {Promise<object>} Cleanup result.
 */
export async function purgeOldMonitorHistory(env, now = new Date()) {
    const settings = await getUiSettings(env);
    const keepDataPeriodDays = Number.parseInt(settings.keepDataPeriodDays, 10);
    if (!Number.isFinite(keepDataPeriodDays) || keepDataPeriodDays < 1) {
        return { deleted: false };
    }

    await ensureDashboardRuntimeCacheTables(env);
    const cutoff = new Date(now.getTime() - keepDataPeriodDays * 24 * 60 * 60 * 1000);
    await runD1(env, "history.purge_heartbeats", env.DB.prepare("DELETE FROM heartbeats WHERE checked_at < ?")
        .bind(formatSqliteDateTime(cutoff)));
    await runD1(env, "history.purge_event_log", env.DB.prepare("DELETE FROM monitor_event_log WHERE checked_at < ?")
        .bind(formatSqliteDateTime(cutoff)));
    await runD1(env, "history.purge_metric_buckets", env.DB.prepare("DELETE FROM monitor_metric_bucket WHERE bucket_start < ?")
        .bind(formatSqliteDateTime(cutoff)));
    return { deleted: true };
}

export async function checkTwingateHealthAlert(env, now = new Date()) {
    const settings = await getUiSettings(env);
    if (!settings.twingateAlertEnabled) {
        return {
            enabled: false,
            degraded: false,
            notified: false,
        };
    }

    const notificationIds = normalizeNotificationIdList(settings.twingateAlertNotificationIDList);
    if (notificationIds.length === 0) {
        return {
            enabled: true,
            degraded: false,
            notified: false,
            reason: "no-notifications",
        };
    }

    const [status, previousState] = await Promise.all([
        fetchRunnerStatus(env),
        getStoredSetting(env, TWINGATE_ALERT_STATE_SETTING),
    ]);
    const nowIso = now.toISOString();
    const degraded = isTwingateAlertStatusDegraded(status);
    const alertState = normalizeTwingateAlertState(previousState);

    if (degraded) {
        const firstDegradedAt = alertState.firstDegradedAt || nowIso;
        const thresholdMet = isTwingateAlertThresholdMet(firstDegradedAt, settings, now);
        const nextState = {
            firstDegradedAt,
            lastStatusAt: nowIso,
            lastError: status.lastError || null,
            notifiedStatus: alertState.notifiedStatus,
            lastNotificationAt: alertState.lastNotificationAt || null,
        };
        let notified = false;

        if (thresholdMet && alertState.notifiedStatus !== "degraded") {
            const notifications = await listActiveNotificationsByIds(env, notificationIds);
            await sendTwingateStatusNotifications(env, notifications, "degraded", status, settings, now);
            nextState.notifiedStatus = "degraded";
            nextState.lastNotificationAt = nowIso;
            notified = notifications.length > 0;
        }

        await storeTwingateAlertStateIfChanged(env, alertState, nextState);
        return {
            enabled: true,
            degraded: true,
            notified,
            thresholdMet,
        };
    }

    let notified = false;
    const nextState = {
        firstDegradedAt: null,
        lastStatusAt: nowIso,
        lastError: null,
        notifiedStatus: alertState.notifiedStatus,
        lastNotificationAt: alertState.lastNotificationAt || null,
    };

    if (alertState.notifiedStatus === "degraded") {
        const notifications = await listActiveNotificationsByIds(env, notificationIds);
        await sendTwingateStatusNotifications(env, notifications, "healthy", status, settings, now);
        nextState.notifiedStatus = "healthy";
        nextState.lastNotificationAt = nowIso;
        notified = notifications.length > 0;
    }

    await storeTwingateAlertStateIfChanged(env, alertState, nextState);
    return {
        enabled: true,
        degraded: false,
        notified,
        thresholdMet: false,
    };
}

/**
 * Persist the Twingate alert state only when a decision-relevant field changed.
 * lastStatusAt is informational and never read back, so steady-state cron runs
 * skip the per-interval D1 write.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {object} previousState Normalized stored alert state.
 * @param {object} nextState Computed next alert state.
 * @returns {Promise<void>} Completion promise.
 */
async function storeTwingateAlertStateIfChanged(env, previousState, nextState) {
    const changed =
        previousState.firstDegradedAt !== (nextState.firstDegradedAt || null) ||
        previousState.lastError !== (nextState.lastError || null) ||
        previousState.notifiedStatus !== (nextState.notifiedStatus || null) ||
        previousState.lastNotificationAt !== (nextState.lastNotificationAt || null);
    if (changed) {
        await setStoredSetting(env, TWINGATE_ALERT_STATE_SETTING, nextState);
    }
}

export async function updateMonitorNetworkRoute(env, monitorId, networkProfileId) {
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }

    if (networkProfileId) {
        const profile = await env.DB.prepare("SELECT id FROM network_profiles WHERE id = ? AND enabled = 1")
            .bind(networkProfileId)
            .first();
        if (!profile) {
            throw httpError(400, "Network profile not found or disabled");
        }
    }

    await env.DB.prepare(
        "UPDATE monitors SET network_profile_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
        .bind(networkProfileId, monitorId)
        .run();
}

export async function executeMonitorCheck(env, monitorId) {
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }
    if (monitor.active !== undefined && !normalizeBoolean(monitor.active)) {
        return buildMonitorPausedSkippedResult();
    }
    if (monitor.type === "group") {
        return await executeGroupMonitorCheck(env, monitor);
    }
    const deployPause = await getDeployMonitorPauseState(env);
    if (deployPause.paused) {
        return buildDeployPauseSkippedResult(deployPause);
    }

    const networkProfile = await resolveMonitorNetworkProfileForCheck(env, monitor);
    const proxy = await getActiveProxy(env, monitor.proxy_id);
    const jobMonitor = proxy ? sanitizeMonitor(monitor) : withAccessSecretHeader(sanitizeMonitor(monitor), env);
    if (proxy) {
        jobMonitor.proxy = proxy;
    }
    const job = {
        monitor: jobMonitor,
        networkProfile,
    };
    let result;
    try {
        result = await callRunner(env, job);
    } catch (error) {
        return {
            skipped: true,
            status: null,
            ping: null,
            msg: error.message || "Runner check failed",
            response: null,
        };
    }
    result = await retryPrivatePingThroughTwingate(env, monitor, job, result);
    result = applyTwingateServiceStatus(networkProfile, result);
    const previousHeartbeat = await getLatestHeartbeatForMonitor(env, monitorId);
    result = await applyMonitorRetryStatus(env, monitor, result);
    const heartbeat = await writeHeartbeat(env, monitorId, result, previousHeartbeat, monitor);
    await sendMonitorStatusNotifications(env, monitor, result, previousHeartbeat, heartbeat);
    return result;
}

async function executeGroupMonitorCheck(env, groupMonitor) {
    const monitors = await listMonitorRows(env);
    const monitorsById = new Map(monitors.map((monitor) => [Number(monitor.id), monitor]));
    const childMonitors = getActiveWorkerLeafMonitors(groupMonitor, monitorsById);
    if (childMonitors.length === 0) {
        return {
            skipped: true,
            status: null,
            ping: null,
            msg: "No active monitors in group",
            response: null,
            checked: 0,
            checks: [],
        };
    }

    const checks = [];
    for (const childMonitor of childMonitors) {
        const result = await executeMonitorCheck(env, Number(childMonitor.id));
        checks.push({
            monitorId: Number(childMonitor.id),
            name: childMonitor.name,
            ...result,
        });
    }

    const statuses = checks
        .map((check) => check.status)
        .filter((status) => status !== undefined && status !== null)
        .map((status) => Number(status));
    const status = aggregateGroupCheckStatus(statuses);

    return {
        skipped: status === null,
        status,
        ping: null,
        msg: `Checked ${childMonitors.length} ${childMonitors.length === 1 ? "monitor" : "monitors"}`,
        response: null,
        checked: childMonitors.length,
        checks,
    };
}

function aggregateGroupCheckStatus(statuses) {
    if (statuses.length === 0) {
        return null;
    }
    if (statuses.includes(DOWN)) {
        return DOWN;
    }
    if (statuses.includes(PENDING)) {
        return PENDING;
    }
    if (statuses.every((status) => status === UP)) {
        return UP;
    }
    return Math.min(...statuses);
}

async function resolveMonitorNetworkProfileForCheck(env, monitor) {
    if (monitor.network_profile_id) {
        return await getNetworkProfile(env, monitor.network_profile_id);
    }
    if (!["ping", "port"].includes(monitor.type) || !shouldUseImportPrivateNetworkProfile(monitor)) {
        return null;
    }

    const networkProfileId = await getImportPrivateNetworkProfileId(env);
    return networkProfileId ? await getNetworkProfile(env, networkProfileId) : null;
}

async function retryPrivatePingThroughTwingate(env, monitor, job, result = {}) {
    if (
        monitor.network_profile_id ||
        monitor.type !== "ping" ||
        Number(result.status) !== DOWN ||
        result.msg !== PRIVATE_WORKER_HOST_ERROR
    ) {
        return result;
    }

    const networkProfileId = await getImportPrivateNetworkProfileId(env);
    if (!networkProfileId) {
        return result;
    }
    const networkProfile = await getNetworkProfile(env, networkProfileId);
    if (!networkProfile) {
        return result;
    }

    try {
        return await callRunner(env, {
            ...job,
            networkProfile,
        });
    } catch (_) {
        return result;
    }
}

function applyTwingateServiceStatus(networkProfile, result = {}) {
    if (!isTwingateNetworkProfile(networkProfile) || !isTwingateServiceUnavailableResult(result)) {
        return result;
    }

    return {
        ...result,
        status: PENDING,
        msg: TWINGATE_SERVICE_NOT_RUNNING_MESSAGE,
    };
}

function isTwingateNetworkProfile(networkProfile) {
    return networkProfile?.slug === "twingate" || networkProfile?.type === "twingate";
}

function isTwingateServiceUnavailableResult(result = {}) {
    if (Number(result.status) !== DOWN) {
        return false;
    }
    const message = String(result.msg || "");
    return /Twingate (?:proxy|service) (?:is )?(?:not ready|not running|isn't running|starting)/i.test(message);
}

function withAccessSecretHeader(monitor, env) {
    const accessSecret = String(env.ACCESS_SECRET || "").trim();
    if (!accessSecret || !ACCESS_SECRET_MONITOR_TYPES.has(monitor.type)) {
        return monitor;
    }

    return {
        ...monitor,
        headers: stringifyMonitorHeaders({
            ...parseMonitorHeaders(monitor.headers),
            [ACCESS_SECRET_HEADER]: accessSecret,
        }),
    };
}

function parseMonitorHeaders(headers) {
    if (!headers) {
        return {};
    }
    if (typeof headers === "string") {
        try {
            const parsed = JSON.parse(headers);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }
    return headers && typeof headers === "object" && !Array.isArray(headers) ? headers : {};
}

function stringifyMonitorHeaders(headers) {
    return Object.keys(headers).length > 0 ? JSON.stringify(headers) : null;
}

export async function enqueueDueMonitors(env, now = new Date()) {
    const deployPause = await getDeployMonitorPauseState(env);
    if (deployPause.paused) {
        return {
            paused: true,
            enqueued: 0,
            pauseUntil: deployPause.pauseUntil,
        };
    }

    const monitors = await listDueMonitorsForEnqueue(env, now);

    await Promise.all(
        monitors.map((monitor) =>
            env.MONITOR_QUEUE.send({
                monitorId: monitor.id,
                queuedAt: now.toISOString(),
            })
        )
    );

    return {
        paused: false,
        enqueued: monitors.length,
    };
}

async function listDueMonitorsForEnqueue(env, now = new Date()) {
    await ensureDashboardRuntimeCacheTables(env);
    const result = await allD1(env, "monitor.enqueue_due", env.DB.prepare(
        `SELECT m.id
         FROM monitors m
         LEFT JOIN monitor_runtime_summary s ON s.monitor_id = m.id
         WHERE m.active = 1
           AND m.type != 'group'
           AND (
                s.checked_at IS NULL
                OR (
                    strftime('%s', ?) - strftime('%s', s.checked_at)
                ) >= CASE
                    WHEN m."interval" IS NOT NULL AND m."interval" > 0 THEN m."interval"
                    ELSE ${DEFAULT_MONITOR_INTERVAL_SECONDS}
                END
           )
         ORDER BY m.id`
    )
        .bind(formatSqliteDateTime(now)));
    return result.results || [];
}

export async function consumeQueue(batch, env) {
    const deployPause = await getDeployMonitorPauseState(env);
    if (deployPause.paused) {
        for (const message of batch.messages || []) {
            message.ack?.();
        }
        return {
            paused: true,
            consumed: 0,
            acknowledged: (batch.messages || []).length,
            pauseUntil: deployPause.pauseUntil,
        };
    }

    let consumed = 0;
    for (const message of batch.messages || []) {
        await executeMonitorCheck(env, Number(message.body.monitorId));
        message.ack?.();
        consumed++;
    }
    return {
        paused: false,
        consumed,
    };
}

async function callRunner(env, job) {
    const stub = getRunnerStub(env);
    const response = await stub.fetch(
        new Request("http://runner/check", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(job),
        })
    );
    if (!response.ok) {
        throw httpError(502, `Runner check failed with ${response.status}${await formatRunnerError(response)}`);
    }
    return await response.json();
}

/**
 * Fetch Twingate status from the runner container without failing the settings API.
 * @param {object} env Worker environment bindings.
 * @returns {Promise<object>} Sanitized Twingate status.
 */
async function fetchRunnerStatus(env) {
    const timeoutMs = resolveTwingateStatusTimeoutMs(env);
    const controller = new AbortController();
    let timeout = null;
    let responsePromise = null;
    try {
        const stub = getRunnerStub(env);
        responsePromise = stub.fetch(new Request("http://runner/twingate/status", {
            signal: controller.signal,
        }));
        void responsePromise.catch(() => {});
        const timeoutPromise = new Promise((_, reject) => {
            timeout = setTimeout(() => {
                controller.abort();
                reject(new Error(`Runner status timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        const response = await Promise.race([
            responsePromise,
            timeoutPromise,
        ]);
        if (!response.ok) {
            return buildTwingateStatusFromRunnerFailure(
                env,
                `Runner status failed with ${response.status}${await formatRunnerError(response)}`
            );
        }
        return sanitizeRunnerStatus(await response.json());
    } catch (error) {
        if (error.name === "AbortError" || error.message === `Runner status timed out after ${timeoutMs}ms`) {
            return buildUnavailableTwingateStatus(env, `Runner status timed out after ${timeoutMs}ms`);
        }
        return buildTwingateStatusFromRunnerFailure(env, `Runner status unavailable: ${error.message}`);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

/**
 * Resolve the runner container stub across local and Cloudflare runtimes.
 * @param {object} env Worker environment bindings.
 * @returns {object} Runner container stub.
 */
function getRunnerStub(env) {
    if (typeof env.RUNNER.getByName === "function") {
        return env.RUNNER.getByName("default");
    }
    if (typeof env.RUNNER.get === "function" && typeof env.RUNNER.idFromName === "function") {
        return env.RUNNER.get(env.RUNNER.idFromName("default"));
    }
    return env.RUNNER.get("default");
}

/**
 * Format a non-OK runner response body for display in the sanitized status log.
 * @param {Response} response Runner response.
 * @returns {Promise<string>} Formatted error suffix.
 */
async function formatRunnerError(response) {
    try {
        const body = await response.clone().json();
        if (typeof body === "string") {
            return body ? `: ${body}` : "";
        }
        return body?.error ? `: ${body.error}` : "";
    } catch {
        const body = await response.text();
        return body ? `: ${body}` : "";
    }
}

async function writeHeartbeat(env, monitorId, result, previousHeartbeat = null, monitor = null) {
    const status = result.status ?? DOWN;
    const checkedAt = formatSqliteDateTime(new Date());
    const persistDecision = shouldPersistRawHeartbeat(env, status, previousHeartbeat, checkedAt);
    let responseR2Key = null;
    let heartbeatId = null;
    if (persistDecision.persistRaw) {
        const responseBody = result.response == null
            ? ""
            : String(result.response).slice(0, WORKER_HEARTBEAT_RESPONSE_MAX_CHARS);
        if (responseBody && env.ARTIFACTS) {
            responseR2Key = `responses/${monitorId}/${Date.now()}.txt`;
            await env.ARTIFACTS.put(responseR2Key, responseBody);
        }

        const insertResult = await runD1(env, "heartbeat.insert", env.DB.prepare(
            "INSERT INTO heartbeats (monitor_id, status, ping, msg, response_r2_key, checked_at) VALUES (?, ?, ?, ?, ?, ?)"
        )
            .bind(monitorId, status, result.ping ?? null, result.msg ?? "", responseR2Key, checkedAt));
        heartbeatId = Number(insertResult?.meta?.last_row_id || 0) || null;
    }

    const heartbeat = {
        id: heartbeatId,
        monitor_id: Number(monitorId),
        status,
        ping: result.ping ?? null,
        msg: result.msg ?? "",
        response_r2_key: responseR2Key,
        checked_at: checkedAt,
    };
    if (monitor) {
        await updateDashboardRuntimeCachesForHeartbeat(env, monitor, heartbeat, previousHeartbeat, {
            recomputeSummary: shouldRecomputeRuntimeSummary(previousHeartbeat, heartbeat, persistDecision),
        });
    }
    return heartbeat;
}

function shouldPersistRawHeartbeat(env, status, previousHeartbeat, checkedAt) {
    const numericStatus = Number(status);
    if (numericStatus !== UP) {
        return { persistRaw: true, sampledOk: false };
    }
    if (!previousHeartbeat) {
        return { persistRaw: true, sampledOk: true };
    }
    if (Number(previousHeartbeat.status) !== UP) {
        return { persistRaw: true, sampledOk: true };
    }

    const sampleSeconds = resolveOkHeartbeatSampleSeconds(env);
    if (sampleSeconds <= 0) {
        return { persistRaw: true, sampledOk: true };
    }
    const previousBucket = formatBucketStart(previousHeartbeat.checked_at, sampleSeconds);
    const currentBucket = formatBucketStart(checkedAt, sampleSeconds);
    return {
        persistRaw: previousBucket !== currentBucket,
        sampledOk: previousBucket !== currentBucket,
    };
}

function shouldRecomputeRuntimeSummary(previousHeartbeat, heartbeat, persistDecision) {
    if (!previousHeartbeat) {
        return true;
    }
    if (Number(previousHeartbeat.status) !== Number(heartbeat.status)) {
        return true;
    }
    return Boolean(persistDecision.sampledOk);
}

function resolveOkHeartbeatSampleSeconds(env = {}) {
    const configured = Number.parseInt(env.OK_HEARTBEAT_SAMPLE_SECONDS, 10);
    if (!Number.isFinite(configured)) {
        return DEFAULT_OK_HEARTBEAT_SAMPLE_SECONDS;
    }
    return Math.max(0, configured);
}

async function updateDashboardRuntimeCachesForHeartbeat(env, monitor, heartbeat, previousHeartbeat = null, options = {}) {
    await ensureDashboardRuntimeCacheTables(env);
    await upsertDashboardMetricBuckets(env, monitor, heartbeat, {
        resolutions: HOT_PATH_DASHBOARD_METRIC_RESOLUTIONS,
    });
    await upsertDashboardEventLog(env, monitor, heartbeat, previousHeartbeat);
    await refreshMonitorRuntimeSummary(env, monitor, heartbeat, {
        recomputeExpensive: Boolean(options.recomputeSummary),
        previousHeartbeat,
    });
}

async function upsertDashboardMetricBuckets(env, monitor, heartbeat, options = {}) {
    const status = Number(effectiveHeartbeatStatus(heartbeat.status, monitor));
    const ping = status === UP && heartbeat.ping != null ? Number(heartbeat.ping) : null;
    const values = {
        up: status === UP ? 1 : 0,
        down: status === DOWN ? 1 : 0,
        pending: status === PENDING ? 1 : 0,
        maintenance: status === MAINTENANCE ? 1 : 0,
        pingSum: Number.isFinite(ping) ? ping : 0,
        minPing: Number.isFinite(ping) ? ping : null,
        maxPing: Number.isFinite(ping) ? ping : null,
    };
    const resolutions = options.resolutions || DASHBOARD_METRIC_RESOLUTIONS;

    for (const resolution of resolutions) {
        await runD1(env, `metric_bucket.upsert.${resolution}`, env.DB.prepare(
            `INSERT INTO monitor_metric_bucket (
                monitor_id, resolution_seconds, bucket_start, up_count, down_count,
                pending_count, maintenance_count, total_count, ping_sum, min_ping, max_ping, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(monitor_id, resolution_seconds, bucket_start) DO UPDATE SET
                up_count = up_count + excluded.up_count,
                down_count = down_count + excluded.down_count,
                pending_count = pending_count + excluded.pending_count,
                maintenance_count = maintenance_count + excluded.maintenance_count,
                total_count = total_count + 1,
                ping_sum = ping_sum + excluded.ping_sum,
                min_ping = CASE
                    WHEN excluded.min_ping IS NULL THEN monitor_metric_bucket.min_ping
                    WHEN monitor_metric_bucket.min_ping IS NULL THEN excluded.min_ping
                    ELSE MIN(monitor_metric_bucket.min_ping, excluded.min_ping)
                END,
                max_ping = CASE
                    WHEN excluded.max_ping IS NULL THEN monitor_metric_bucket.max_ping
                    WHEN monitor_metric_bucket.max_ping IS NULL THEN excluded.max_ping
                    ELSE MAX(monitor_metric_bucket.max_ping, excluded.max_ping)
                END,
                updated_at = CURRENT_TIMESTAMP`
        )
            .bind(
                Number(heartbeat.monitor_id),
                resolution,
                formatBucketStart(heartbeat.checked_at, resolution),
                values.up,
                values.down,
                values.pending,
                values.maintenance,
                values.pingSum,
                values.minPing,
                values.maxPing
            ));
    }
}

/**
 * Rebuild coarser metric buckets from the per-check 60-second buckets.
 * @param {object} env Worker environment bindings.
 * @param {object} options Rollup options.
 * @param {number[]} options.resolutions Target resolutions to roll up.
 * @param {string|null} options.since Optional lower bucket_start bound.
 * @param {number|null} options.monitorId Optional monitor filter.
 * @returns {Promise<object>} Rollup count.
 */
export async function rollupDashboardMetricBuckets(env, options = {}) {
    await ensureDashboardRuntimeCacheTables(env);
    const resolutions = (options.resolutions || DASHBOARD_ROLLUP_RESOLUTIONS)
        .map(Number)
        .filter((resolution) => DASHBOARD_ROLLUP_RESOLUTIONS.includes(resolution));
    let rolledUp = 0;

    for (const resolution of resolutions) {
        const rows = await listMetricRollupRows(env, resolution, options);
        for (const row of rows) {
            await upsertMetricRollupBucket(env, row);
            rolledUp++;
        }
    }

    return { rolledUp };
}

async function listMetricRollupRows(env, resolutionSeconds, options = {}) {
    const since = options.since || "0000-01-01 00:00:00";
    const monitorFilter = options.monitorId == null ? "" : "AND monitor_id = ?";
    const bucketExpression = Number(resolutionSeconds) === 86400
        ? "strftime('%Y-%m-%d 00:00:00', bucket_start)"
        : "strftime('%Y-%m-%d %H:00:00', bucket_start)";
    const values = options.monitorId == null
        ? [since]
        : [since, Number(options.monitorId)];

    const result = await allD1(env, `metric_bucket.rollup_select.${resolutionSeconds}`, env.DB.prepare(
        `SELECT
            monitor_id,
            ? AS resolution_seconds,
            ${bucketExpression} AS bucket_start,
            SUM(up_count) AS up_count,
            SUM(down_count) AS down_count,
            SUM(pending_count) AS pending_count,
            SUM(maintenance_count) AS maintenance_count,
            SUM(total_count) AS total_count,
            SUM(ping_sum) AS ping_sum,
            MIN(min_ping) AS min_ping,
            MAX(max_ping) AS max_ping
         FROM monitor_metric_bucket
         WHERE resolution_seconds = 60
           AND bucket_start >= ?
           ${monitorFilter}
         GROUP BY monitor_id, ${bucketExpression}
         ORDER BY monitor_id, bucket_start`
    )
        .bind(Number(resolutionSeconds), ...values));
    return result.results || [];
}

async function upsertMetricRollupBucket(env, row) {
    await runD1(env, `metric_bucket.rollup_upsert.${row.resolution_seconds}`, env.DB.prepare(
        `INSERT INTO monitor_metric_bucket (
            monitor_id, resolution_seconds, bucket_start, up_count, down_count,
            pending_count, maintenance_count, total_count, ping_sum, min_ping, max_ping, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(monitor_id, resolution_seconds, bucket_start) DO UPDATE SET
            up_count = excluded.up_count,
            down_count = excluded.down_count,
            pending_count = excluded.pending_count,
            maintenance_count = excluded.maintenance_count,
            total_count = excluded.total_count,
            ping_sum = excluded.ping_sum,
            min_ping = excluded.min_ping,
            max_ping = excluded.max_ping,
            updated_at = CURRENT_TIMESTAMP`
    )
        .bind(
            Number(row.monitor_id),
            Number(row.resolution_seconds),
            row.bucket_start,
            Number(row.up_count || 0),
            Number(row.down_count || 0),
            Number(row.pending_count || 0),
            Number(row.maintenance_count || 0),
            Number(row.total_count || 0),
            Number(row.ping_sum || 0),
            row.min_ping == null ? null : Number(row.min_ping),
            row.max_ping == null ? null : Number(row.max_ping)
        ));
}

async function upsertDashboardEventLog(env, monitor, heartbeat, previousHeartbeat = null) {
    const status = Number(effectiveHeartbeatStatus(heartbeat.status, monitor));
    const previousStatus = previousHeartbeat
        ? Number(effectiveHeartbeatStatus(previousHeartbeat.status, monitor))
        : null;
    const isImportant = status === DOWN || status === PENDING || (status === UP && isDegradedStatus(previousStatus));
    const heartbeatId = Number(heartbeat.id || 0);
    if (!heartbeatId) {
        return;
    }

    if (!isImportant) {
        await runD1(env, "event_log.delete_unimportant", env.DB.prepare("DELETE FROM monitor_event_log WHERE heartbeat_id = ?")
            .bind(heartbeatId));
        return;
    }

    await runD1(env, "event_log.upsert", env.DB.prepare(
        `INSERT INTO monitor_event_log (heartbeat_id, monitor_id, status, ping, msg, checked_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(heartbeat_id) DO UPDATE SET
            monitor_id = excluded.monitor_id,
            status = excluded.status,
            ping = excluded.ping,
            msg = excluded.msg,
            checked_at = excluded.checked_at`
    )
        .bind(
            heartbeatId,
            Number(heartbeat.monitor_id),
            status,
            heartbeat.ping ?? null,
            heartbeat.msg ?? "",
            heartbeat.checked_at
        ));
}

function isDegradedStatus(status) {
    return status === DOWN || status === PENDING;
}

async function refreshMonitorRuntimeSummary(env, monitor, latestHeartbeat = null, options = {}) {
    const heartbeat = latestHeartbeat || await getLatestHeartbeatForMonitor(env, Number(monitor.id));
    if (options.recomputeExpensive === false) {
        await refreshMonitorRuntimeSummaryLatestFields(env, monitor, heartbeat, options.previousHeartbeat);
        return;
    }

    const heartbeats = await listRecentSerializedHeartbeatsForSummary(env, monitor);
    const referenceTime = heartbeat?.checked_at || formatSqliteDateTime(new Date());
    const metrics24 = await summarizeMetricBuckets(env, Number(monitor.id), 60, referenceTime, 24);
    const metrics720 = await summarizeMetricBuckets(env, Number(monitor.id), 3600, referenceTime, 720);
    const metrics1y = await summarizeMetricBuckets(env, Number(monitor.id), 86400, referenceTime, 24 * 365);
    const status = heartbeat ? Number(effectiveHeartbeatStatus(heartbeat.status, monitor)) : null;

    await runD1(env, "runtime_summary.refresh_full", env.DB.prepare(
        `INSERT INTO monitor_runtime_summary (
            monitor_id, latest_heartbeat_id, status, ping, msg, checked_at,
            avg_ping, uptime_24, uptime_720, uptime_1y, heartbeat_bar_json, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(monitor_id) DO UPDATE SET
            latest_heartbeat_id = excluded.latest_heartbeat_id,
            status = excluded.status,
            ping = excluded.ping,
            msg = excluded.msg,
            checked_at = excluded.checked_at,
            avg_ping = excluded.avg_ping,
            uptime_24 = excluded.uptime_24,
            uptime_720 = excluded.uptime_720,
            uptime_1y = excluded.uptime_1y,
            heartbeat_bar_json = excluded.heartbeat_bar_json,
            updated_at = CURRENT_TIMESTAMP`
    )
        .bind(
            Number(monitor.id),
            heartbeat?.id ?? null,
            status,
            heartbeat?.ping ?? null,
            heartbeat?.msg ?? "",
            heartbeat?.checked_at ?? null,
            metrics24.avgPing,
            metrics24.uptime,
            metrics720.uptime,
            metrics1y.uptime,
            JSON.stringify(heartbeats)
        ));
}

async function refreshMonitorRuntimeSummaryLatestFields(env, monitor, heartbeat = null, previousHeartbeat = null) {
    const status = heartbeat ? Number(effectiveHeartbeatStatus(heartbeat.status, monitor)) : null;
    await runD1(env, "runtime_summary.refresh_latest", env.DB.prepare(
        `INSERT INTO monitor_runtime_summary (
            monitor_id, latest_heartbeat_id, status, ping, msg, checked_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(monitor_id) DO UPDATE SET
            latest_heartbeat_id = excluded.latest_heartbeat_id,
            status = excluded.status,
            ping = excluded.ping,
            msg = excluded.msg,
            checked_at = excluded.checked_at,
            updated_at = CURRENT_TIMESTAMP`
    )
        .bind(
            Number(monitor.id),
            heartbeat?.id ?? previousHeartbeat?.id ?? null,
            status,
            heartbeat?.ping ?? null,
            heartbeat?.msg ?? "",
            heartbeat?.checked_at ?? null
        ));
}

async function listRecentSerializedHeartbeatsForSummary(env, monitor) {
    const result = await env.DB.prepare(
        `SELECT id, monitor_id, status, ping, msg, checked_at
         FROM heartbeats
         WHERE monitor_id = ?
         ORDER BY checked_at DESC, id DESC
         LIMIT ?`
    )
        .bind(Number(monitor.id), DASHBOARD_HEARTBEAT_BAR_LIMIT)
        .all();
    return (result.results || [])
        .slice()
        .reverse()
        .map((heartbeat) => serializeHeartbeat(heartbeat, monitor));
}

async function summarizeMetricBuckets(env, monitorId, resolutionSeconds, referenceTime, periodHours) {
    const since = formatSqliteDateTime(new Date(parseSqliteDateTime(referenceTime) - periodHours * 60 * 60 * 1000));
    const result = await env.DB.prepare(
        `SELECT
            SUM(up_count) AS up_count,
            SUM(total_count) AS total_count,
            SUM(ping_sum) AS ping_sum
         FROM monitor_metric_bucket
         WHERE monitor_id = ?
           AND resolution_seconds = ?
           AND bucket_start >= ?`
    )
        .bind(Number(monitorId), Number(resolutionSeconds), since)
        .first();
    const upCount = Number(result?.up_count || 0);
    const totalCount = Number(result?.total_count || 0);
    const pingSum = Number(result?.ping_sum || 0);
    return {
        uptime: totalCount > 0 ? upCount / totalCount : null,
        avgPing: upCount > 0 ? Math.round(pingSum / upCount) : null,
    };
}

function formatBucketStart(value, resolutionSeconds) {
    const timestamp = parseSqliteDateTime(value);
    const bucketStart = Math.floor(timestamp / (resolutionSeconds * 1000)) * resolutionSeconds * 1000;
    return formatSqliteDateTime(new Date(bucketStart));
}

/**
 * Load the latest heartbeat for a single monitor.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number} monitorId Monitor ID.
 * @returns {Promise<object|null>} Latest heartbeat row, if one exists.
 */
async function getLatestHeartbeatForMonitor(env, monitorId) {
    return (await listLatestHeartbeatsByMonitorId(env, [Number(monitorId)])).get(Number(monitorId)) || null;
}

/**
 * Send assigned notifications when a Worker check changes monitor status.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {object} monitor Monitor row.
 * @param {object} result Current check result.
 * @param {object|null} previousHeartbeat Previous heartbeat row.
 * @param {object} heartbeat New heartbeat row.
 * @returns {Promise<void>}
 */
async function sendMonitorStatusNotifications(env, monitor, result, previousHeartbeat, heartbeat) {
    const currentStatus = Number(result.status ?? DOWN);
    const previousStatus = previousHeartbeat ? Number(previousHeartbeat.status) : null;
    const isFirstHeartbeat = previousHeartbeat == null;

    if (!shouldSendStatusNotification(isFirstHeartbeat, previousStatus, currentStatus)) {
        return;
    }

    const [settings, notifications, tagsByMonitorId] = await Promise.all([
        getUiSettings(env),
        listActiveMonitorNotifications(env, Number(monitor.id)),
        listTagsByMonitorId(env, [Number(monitor.id)]),
    ]);
    if (notifications.length === 0) {
        return;
    }

    const monitorJSON = buildNotificationMonitorJSON(monitor, tagsByMonitorId.get(Number(monitor.id)) || []);
    const heartbeatJSON = buildNotificationHeartbeatJSON(heartbeat, settings);
    const msg = buildMonitorStatusMessage(monitorJSON, heartbeatJSON);

    await Promise.all(
        notifications.map(async (notification) => {
            try {
                await sendWorkerMonitorNotification(notification, msg, monitorJSON, heartbeatJSON, settings);
            } catch (error) {
                console.error(
                    `Cannot send notification to ${notification.name || notification.type || notification.id}: ${
                        error?.message || String(error)
                    }`
                );
            }
        })
    );
}

/**
 * Decide if a status transition should notify users.
 * @param {boolean} isFirstHeartbeat Whether this is the first heartbeat.
 * @param {number|null} previousStatus Previous heartbeat status.
 * @param {number} currentStatus Current heartbeat status.
 * @returns {boolean} True when notification delivery should run.
 */
function shouldSendStatusNotification(isFirstHeartbeat, previousStatus, currentStatus) {
    if (isFirstHeartbeat) {
        return currentStatus === DOWN;
    }

    return (
        (previousStatus === MAINTENANCE && currentStatus === DOWN) ||
        (previousStatus === UP && currentStatus === DOWN) ||
        (previousStatus === DOWN && currentStatus === UP) ||
        (previousStatus === PENDING && currentStatus === DOWN)
    );
}

/**
 * Load active notifications assigned to a monitor.
 * @param {object} env Cloudflare Worker environment bindings.
 * @param {number} monitorId Monitor ID.
 * @returns {Promise<object[]>} Active notification configs.
 */
async function listActiveMonitorNotifications(env, monitorId) {
    const [notificationsByMonitorId, notifications] = await Promise.all([
        listMonitorNotificationsByMonitorId(env, [monitorId]),
        listNotifications(env),
    ]);
    const assignedNotifications = notificationsByMonitorId.get(Number(monitorId)) || {};
    return notifications
        .filter((notification) => assignedNotifications[Number(notification.id)])
        .map(hydrateStoredNotification)
        .filter(isStoredNotificationActive);
}

async function listActiveNotificationsByIds(env, notificationIds) {
    const idSet = new Set((notificationIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0));
    if (idSet.size === 0) {
        return [];
    }
    const notifications = await listNotifications(env);
    return notifications
        .filter((notification) => idSet.has(Number(notification.id)))
        .map(hydrateStoredNotification)
        .filter(isStoredNotificationActive);
}

async function sendTwingateStatusNotifications(env, notifications, state, status, settings, now) {
    if (notifications.length === 0) {
        return;
    }

    const monitorJSON = {
        id: null,
        active: true,
        name: "Twingate",
        type: "twingate",
        url: null,
        hostname: null,
        port: null,
        tags: [],
    };
    const heartbeatJSON = buildNotificationHeartbeatJSON({
        monitor_id: 0,
        status: state === "healthy" ? UP : DOWN,
        ping: null,
        msg: state === "healthy" ? "Twingate is running again." : buildTwingateAlertMessage(status),
        checked_at: formatSqliteDateTime(now),
    }, settings);
    const msg = buildMonitorStatusMessage(monitorJSON, heartbeatJSON);

    await Promise.all(
        notifications.map(async (notification) => {
            try {
                await sendWorkerMonitorNotification(notification, msg, monitorJSON, heartbeatJSON, settings);
            } catch (error) {
                console.error(
                    `Cannot send Twingate alert to ${notification.name || notification.type || notification.id}: ${
                        error?.message || String(error)
                    }`
                );
            }
        })
    );
}

function buildTwingateAlertMessage(status = {}) {
    const base = status.starting
        ? "Twingate is still starting after the alert threshold."
        : "Twingate is configured but not running.";
    const details = String(status.lastError || "").trim();
    return details ? `${base} ${details}` : base;
}

function isTwingateAlertStatusDegraded(status = {}) {
    return Boolean(status.configured) && !Boolean(status.running);
}

function isTwingateAlertThresholdMet(firstDegradedAt, settings, now) {
    const firstDegradedTime = Date.parse(firstDegradedAt);
    if (!Number.isFinite(firstDegradedTime)) {
        return false;
    }
    return now.getTime() - firstDegradedTime >= resolveTwingateAlertThresholdMs(settings);
}

function resolveTwingateAlertThresholdMs(settings = {}) {
    const requestedMinutes = Number.parseInt(settings.twingateAlertThresholdMinutes, 10);
    const minutes = Number.isFinite(requestedMinutes)
        ? Math.min(MAX_TWINGATE_ALERT_THRESHOLD_MINUTES, Math.max(MIN_TWINGATE_ALERT_THRESHOLD_MINUTES, requestedMinutes))
        : DEFAULT_TWINGATE_ALERT_THRESHOLD_MINUTES;
    return minutes * 60 * 1000;
}

function normalizeTwingateAlertState(value) {
    const state = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
        firstDegradedAt: normalizeIsoDateString(state.firstDegradedAt),
        lastStatusAt: normalizeIsoDateString(state.lastStatusAt),
        lastError: typeof state.lastError === "string" ? state.lastError : null,
        notifiedStatus: ["degraded", "healthy"].includes(state.notifiedStatus) ? state.notifiedStatus : null,
        lastNotificationAt: normalizeIsoDateString(state.lastNotificationAt),
    };
}

function normalizeIsoDateString(value) {
    if (typeof value !== "string" || !value) {
        return null;
    }
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

/**
 * Merge stored row metadata with notification provider config.
 * @param {object} notification Stored notification row.
 * @returns {object} Hydrated notification config.
 */
function hydrateStoredNotification(notification) {
    const config = parseNotificationConfig(notification.config);
    return {
        ...config,
        id: Number(notification.id),
        name: notification.name || config.name || config.type || "Notification",
        active: notification.active,
        isDefault: notification.isDefault,
    };
}

/**
 * Parse stored notification config JSON.
 * @param {string|null} value Stored JSON string.
 * @returns {object} Parsed config.
 */
function parseNotificationConfig(value) {
    if (!value || typeof value !== "string") {
        return {};
    }
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Check whether a stored notification is active.
 * @param {object} notification Hydrated notification config.
 * @returns {boolean} True when active.
 */
function isStoredNotificationActive(notification) {
    return notification.active === undefined || normalizeBoolean(notification.active);
}

/**
 * Send a monitor status notification through a supported Worker provider.
 * @param {object} notification Hydrated notification config.
 * @param {string} msg Notification message.
 * @param {object} monitorJSON Serialized monitor data.
 * @param {object} heartbeatJSON Serialized heartbeat data.
 * @param {object} settings Worker UI settings.
 * @returns {Promise<void>}
 */
async function sendWorkerMonitorNotification(notification, msg, monitorJSON, heartbeatJSON, settings) {
    if (notification.type === "pushover") {
        await sendPushoverNotification(notification, msg, {
            heartbeatJSON,
            monitorJSON,
            primaryBaseURL: settings.primaryBaseURL,
        });
        return;
    }

    if (notification.type === "teams") {
        await sendTeamsNotification(
            notification,
            buildTeamsMonitorNotificationPayload(monitorJSON, heartbeatJSON, {
                ...settings,
                teamsEnableTags: notification.teamsEnableTags,
            })
        );
        return;
    }

    console.warn(`Notification type "${notification.type}" is not supported by Worker status delivery yet.`);
}

/**
 * Serialize monitor data for notification providers.
 * @param {object} monitor Monitor row.
 * @param {object[]} tags Monitor tags.
 * @returns {object} Serialized monitor.
 */
function buildNotificationMonitorJSON(monitor, tags = []) {
    return {
        id: Number(monitor.id),
        active: monitor.active === undefined ? true : normalizeBoolean(monitor.active),
        name: monitor.name || "",
        type: monitor.type,
        url: monitor.url ?? null,
        hostname: monitor.hostname ?? null,
        port: monitor.port ?? null,
        tags,
    };
}

/**
 * Serialize heartbeat data for notification providers.
 * @param {object} heartbeat Heartbeat row.
 * @param {object} settings Worker UI settings.
 * @returns {object} Serialized heartbeat.
 */
function buildNotificationHeartbeatJSON(heartbeat, settings) {
    const status = Number(heartbeat.status ?? DOWN);
    const time = heartbeat.checked_at || formatSqliteDateTime(new Date());
    const date = parseWorkerHeartbeatDate(time);
    const timezone = resolveNotificationTimezone(settings.serverTimezone);
    return {
        monitorID: Number(heartbeat.monitor_id),
        status,
        ping: heartbeat.ping ?? null,
        msg: heartbeat.msg || "N/A",
        time,
        timezone,
        timezoneOffset: formatTimezoneOffset(date, timezone),
        localDateTime: formatDateTimeInTimezone(date, timezone),
    };
}

/**
 * Build the provider-neutral monitor status message.
 * @param {object} monitorJSON Serialized monitor data.
 * @param {object} heartbeatJSON Serialized heartbeat data.
 * @returns {string} Notification message.
 */
function buildMonitorStatusMessage(monitorJSON, heartbeatJSON) {
    return `[${monitorJSON.name}] [${heartbeatJSON.status === UP ? "Up" : "Down"}] ${heartbeatJSON.msg || "N/A"}`;
}

/**
 * Parse Worker heartbeat timestamps as UTC instants.
 * @param {string} value Stored heartbeat time.
 * @returns {Date} Parsed date.
 */
function parseWorkerHeartbeatDate(value) {
    const text = String(value || "").trim();
    if (!text) {
        return new Date();
    }
    const normalized = text.includes("T") ? text : `${text.replace(" ", "T")}Z`;
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

/**
 * Resolve the configured notification timezone.
 * @param {string} value Configured timezone.
 * @returns {string} Valid timezone name.
 */
function resolveNotificationTimezone(value) {
    const timezone = String(value || "UTC").trim() || "UTC";
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
        return timezone;
    } catch {
        return "UTC";
    }
}

/**
 * Format a date in the configured timezone.
 * @param {Date} date Date to format.
 * @param {string} timezone Timezone name.
 * @returns {string} SQL-style local date/time string.
 */
function formatDateTimeInTimezone(date, timezone) {
    const parts = getTimeZoneDateParts(date, timezone);
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Format the timezone offset for a date.
 * @param {Date} date Date to inspect.
 * @param {string} timezone Timezone name.
 * @returns {string} Offset in +/-HH:mm form.
 */
function formatTimezoneOffset(date, timezone) {
    const parts = getTimeZoneDateParts(date, timezone);
    const localAsUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );
    const offsetMinutes = Math.round((localAsUtc - date.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(offsetMinutes);
    return `${sign}${String(Math.floor(absoluteMinutes / 60)).padStart(2, "0")}:${String(absoluteMinutes % 60).padStart(2, "0")}`;
}

/**
 * Get date/time parts for a timezone.
 * @param {Date} date Date to format.
 * @param {string} timezone Timezone name.
 * @returns {object} Date/time parts keyed by part type.
 */
function getTimeZoneDateParts(date, timezone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        hourCycle: "h23",
    });
    return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

/**
 * Build a dashboard URL for a monitor.
 * @param {string} primaryBaseURL Configured base URL.
 * @param {number} monitorId Monitor ID.
 * @returns {string} Dashboard URL, or an empty string.
 */
function buildMonitorDashboardUrl(primaryBaseURL, monitorId) {
    const baseURL = String(primaryBaseURL || "").trim().replace(/\/+$/, "");
    if (!baseURL || !monitorId) {
        return "";
    }
    return `${baseURL}/dashboard/${monitorId}`;
}

/**
 * Build a human-readable monitor target.
 * @param {object} monitor Serialized monitor data.
 * @returns {string} Target URL or host.
 */
function buildMonitorTargetUrl(monitor) {
    if (monitor?.url) {
        return String(monitor.url);
    }
    if (monitor?.hostname && monitor?.port) {
        return `${monitor.hostname}:${monitor.port}`;
    }
    return monitor?.hostname ? String(monitor.hostname) : "";
}

/**
 * Check if a value is an HTTP URL.
 * @param {string} value Value to check.
 * @returns {boolean} True when value starts with HTTP or HTTPS.
 */
function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || ""));
}

/**
 * Build the Teams summary for a status notification.
 * @param {string} monitorName Monitor name.
 * @param {number} status Heartbeat status.
 * @returns {string} Teams summary.
 */
function buildTeamsStatusSummary(monitorName, status) {
    if (Number(status) === DOWN) {
        return `[${monitorName || "Monitor"}] went down`;
    }
    if (Number(status) === UP) {
        return `[${monitorName || "Monitor"}] is back online`;
    }
    return `[${monitorName || "Monitor"}] status changed`;
}

/**
 * Format a monitor tag for notification text.
 * @param {object} tag Monitor tag.
 * @returns {string} Display text.
 */
function formatTagForNotification(tag) {
    if (tag.value === "" || tag.value === undefined || tag.value === null) {
        return tag.name;
    }
    return `${tag.name}: ${tag.value}`;
}

async function applyMonitorRetryStatus(env, monitor, result = {}) {
    const status = Number(result.status ?? DOWN);
    if (status !== DOWN) {
        return {
            ...result,
            status,
        };
    }

    const maxRetries = resolveMonitorMaxRetries(monitor);
    if (maxRetries <= 0) {
        return {
            ...result,
            status: DOWN,
        };
    }

    const recentFailures = await countRecentMonitorFailures(env, monitor.id, maxRetries);
    return {
        ...result,
        status: recentFailures < maxRetries ? PENDING : DOWN,
    };
}

function resolveMonitorMaxRetries(monitor = {}) {
    const config = parseMonitorConfig(monitor.config_json);
    const value = config.maxretries ?? monitor.maxretries ?? 0;
    const maxRetries = Number.parseInt(value, 10);
    return Number.isFinite(maxRetries) && maxRetries > 0 ? maxRetries : 0;
}

async function countRecentMonitorFailures(env, monitorId, maxRetries) {
    const limit = Math.max(1, Number(maxRetries || 0) + 1);
    const result = await allD1(env, "monitor.recent_failures", env.DB.prepare(
        "SELECT status FROM heartbeats WHERE monitor_id = ? ORDER BY checked_at DESC, id DESC LIMIT ?"
    )
        .bind(monitorId, limit));

    let failures = 0;
    for (const heartbeat of result.results || []) {
        const status = Number(heartbeat.status);
        if (status === PENDING || status === DOWN) {
            failures++;
            continue;
        }
        break;
    }
    return failures;
}

// Once a Worker version is observed unpaused, nothing can re-enter the pause
// window for that version, so the verdict is cached per isolate to avoid a D1
// settings read on every queued monitor check, queue batch, and cron tick.
const resolvedDeployPauseStateByDb = new WeakMap();

export async function getDeployMonitorPauseState(env, now = new Date()) {
    const versionId = resolveWorkerVersionId(env);
    if (!versionId) {
        return {
            paused: false,
            versionId: null,
            pauseUntil: null,
        };
    }

    const cached = env.DB ? resolvedDeployPauseStateByDb.get(env.DB) : null;
    if (cached && cached.versionId === versionId) {
        return cached.state;
    }

    const stored = await getStoredSetting(env, DEPLOY_MONITOR_PAUSE_SETTING);
    const storedVersionId = typeof stored?.versionId === "string" ? stored.versionId : null;
    const storedPauseUntil = parsePauseUntil(stored?.pauseUntil);
    if (storedVersionId !== versionId) {
        const pauseUntil = new Date(now.getTime() + resolveDeployMonitorPauseMs(env)).toISOString();
        await setStoredSetting(env, DEPLOY_MONITOR_PAUSE_SETTING, {
            versionId,
            pauseUntil,
        });
        if (await shouldResumeDeployMonitorPause(env)) {
            return await endDeployMonitorPause(env, versionId, now);
        }
        return {
            paused: true,
            versionId,
            pauseUntil,
        };
    }

    if (storedPauseUntil && storedPauseUntil.getTime() > now.getTime()) {
        if (await shouldResumeDeployMonitorPause(env)) {
            return await endDeployMonitorPause(env, versionId, now);
        }
        return {
            paused: true,
            versionId,
            pauseUntil: storedPauseUntil.toISOString(),
        };
    }

    return cacheUnpausedDeployState(env, {
        paused: false,
        versionId,
        pauseUntil: storedPauseUntil ? storedPauseUntil.toISOString() : null,
    });
}

function cacheUnpausedDeployState(env, state) {
    if (env.DB) {
        resolvedDeployPauseStateByDb.set(env.DB, {
            versionId: state.versionId,
            state,
        });
    }
    return state;
}

async function shouldResumeDeployMonitorPause(env) {
    try {
        const status = await fetchRunnerStatus(env);
        return Boolean(status.configured && status.running);
    } catch (_) {
        return false;
    }
}

async function endDeployMonitorPause(env, versionId, now) {
    const pauseUntil = now.toISOString();
    await setStoredSetting(env, DEPLOY_MONITOR_PAUSE_SETTING, {
        versionId,
        pauseUntil,
    });
    return cacheUnpausedDeployState(env, {
        paused: false,
        versionId,
        pauseUntil,
    });
}

function resolveWorkerVersionId(env) {
    const versionId = env.CF_VERSION_METADATA?.id;
    return typeof versionId === "string" && versionId.trim() ? versionId.trim() : null;
}

function resolveDeployMonitorPauseMs(env) {
    const seconds = Number.parseInt(env.DEPLOY_MONITOR_PAUSE_SECONDS, 10);
    const normalizedSeconds = Number.isFinite(seconds) && seconds >= 0
        ? seconds
        : DEFAULT_DEPLOY_MONITOR_PAUSE_SECONDS;
    return normalizedSeconds * 1000;
}

function parsePauseUntil(value) {
    if (typeof value !== "string" || !value) {
        return null;
    }
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}

function buildDeployPauseSkippedResult(deployPause) {
    return {
        skipped: true,
        status: null,
        ping: null,
        msg: deployPause.pauseUntil
            ? `${DEPLOY_MONITOR_PAUSE_MESSAGE} until ${deployPause.pauseUntil}`
            : DEPLOY_MONITOR_PAUSE_MESSAGE,
        response: null,
    };
}

function buildMonitorPausedSkippedResult() {
    return {
        skipped: true,
        status: null,
        ping: null,
        msg: MONITOR_PAUSED_MESSAGE,
        response: null,
    };
}

async function getMonitor(env, monitorId) {
    return await env.DB.prepare("SELECT * FROM monitors WHERE id = ?")
        .bind(monitorId)
        .first();
}

async function updateMonitorParent(env, monitorId, parent) {
    await env.DB.prepare("UPDATE monitors SET parent = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(parent, monitorId)
        .run();
}

/**
 * Ensure the D1 monitor parent column exists before importing grouped monitors.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<void>}
 */
async function ensureMonitorParentColumn(env) {
    if (!(await isMissingColumn(env, "monitors", "parent"))) {
        return;
    }

    try {
        await env.DB.prepare("ALTER TABLE monitors ADD COLUMN parent INTEGER").run();
    } catch (error) {
        if (!DUPLICATE_COLUMN_ERROR.test(error.message || "")) {
            throw error;
        }
    }
    await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monitors_parent ON monitors(parent)").run();
}

async function updateDeletedMonitorChildren(env, monitorId) {
    try {
        await env.DB.prepare("UPDATE monitors SET parent = NULL, updated_at = CURRENT_TIMESTAMP WHERE parent = ?")
            .bind(monitorId)
            .run();
    } catch (error) {
        if (!MISSING_PARENT_COLUMN.test(error.message || "")) {
            throw error;
        }
    }
}

async function getNetworkProfile(env, networkProfileId) {
    return await env.DB.prepare("SELECT id, slug, name, type, enabled FROM network_profiles WHERE id = ?")
        .bind(networkProfileId)
        .first();
}

function sanitizeMonitor(monitor) {
    const config = parseMonitorConfig(monitor.config_json);
    const sanitized = {
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        url: monitor.url,
        hostname: monitor.hostname,
        port: monitor.port,
        method: monitor.method || "GET",
        headers: monitor.headers,
        body: monitor.body,
        keyword: monitor.keyword,
        invertKeyword: Boolean(monitor.invert_keyword),
        jsonPath: monitor.json_path,
        expectedValue: monitor.expected_value,
        timeout: monitor.timeout,
        saveResponse: normalizeBoolean(config.saveResponse),
        saveErrorResponse: normalizeBoolean(config.saveErrorResponse),
        responseMaxLength: normalizeRunnerResponseMaxLength(config.responseMaxLength),
        packetSize: config.packetSize,
        ping_count: config.ping_count,
        ping_numeric: config.ping_numeric,
        ping_per_request_timeout: config.ping_per_request_timeout,
        twingatePingFallbackPorts: config.twingatePingFallbackPorts,
    };
    if (ACCESS_SECRET_MONITOR_TYPES.has(monitor.type)) {
        sanitized.ignoreTls = resolveMonitorIgnoreTls(monitor, config);
    }
    return sanitized;
}

function normalizeMonitorInput(input, existing = {}) {
    const monitor = {
        ...existing,
        ...(input || {}),
    };
    if (!WORKER_MONITOR_TYPES.has(monitor.type)) {
        throw httpError(400, `Monitor type ${monitor.type} is not supported by the Cloudflare Worker UI`);
    }
    const name = String(monitor.name || "").trim();
    if (!name) {
        throw httpError(400, "Monitor name is required");
    }

    const interval = Number(monitor.interval || existing.interval || 60);
    const timeout = Number(monitor.timeout || existing.timeout || 30);
    const networkProfileId = normalizeNetworkProfileId(resolveMonitorNetworkProfileInput(input, existing));
    const parent = normalizeMonitorParent(monitor.parent ?? existing.parent);
    const proxyId = normalizeProxyId(resolveMonitorProxyInput(input, existing));
    assertWorkerTargetAllowed(monitor, networkProfileId);

    return {
        name,
        type: monitor.type,
        url: monitor.url || null,
        hostname: monitor.hostname || null,
        port: monitor.port === "" || monitor.port == null ? null : Number(monitor.port),
        method: monitor.method || "GET",
        headers: monitor.headers || null,
        body: monitor.body || null,
        keyword: monitor.keyword || null,
        invertKeyword: monitor.invertKeyword || monitor.invert_keyword ? 1 : 0,
        jsonPath: monitor.jsonPath || monitor.json_path || "$",
        expectedValue: monitor.expectedValue ?? monitor.expected_value ?? null,
        timeout: Number.isFinite(timeout) && timeout > 0 ? timeout : 30,
        interval: Number.isFinite(interval) && interval > 0 ? interval : 60,
        active: monitor.active === undefined ? 1 : (monitor.active ? 1 : 0),
        networkProfileId,
        parent,
        proxyId,
    };
}

async function requireRoutePermission(request, env, route) {
    const permission = resolveRoutePermission(route, request.method);
    if (!permission) {
        return null;
    }

    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (isAdminApiToken(env, suppliedToken)) {
        return buildSystemAdminActor();
    }

    await ensureUserAuthSchema(env);
    const usersConfigured = await hasAnyWorkerUsers(env);
    const actor = usersConfigured ? await verifyWorkerAuthSessionToken(suppliedToken, env) : null;
    if (actor) {
        if (!actorHasPermission(actor, permission)) {
            throw httpError(403, "Forbidden");
        }
        return actor;
    }

    if (!usersConfigured) {
        if (await isCloudflareAccessAdminRequest(request, env)) {
            return buildBootstrapAdminActor();
        }
        if (!hasConfiguredAdminApiToken(env)) {
            throw httpError(503, "Admin API token is not configured");
        }
    }

    throw httpError(401, "Unauthorized");
}

function resolveRoutePermission(route, method) {
    if (route.name === "settings") {
        return method === "PUT" ? "settings.write" : "settings.read";
    }
    if (route.name === "monitor-heartbeats") {
        return method === "DELETE" ? "heartbeats.clear" : "heartbeats.read";
    }
    if (route.name === "auth-local-user") {
        return "security.self";
    }
    return ROUTE_PERMISSIONS.get(route.name) || null;
}

async function getWorkerAuthSession(request, env) {
    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (isAdminApiToken(env, suppliedToken)) {
        const actor = buildSystemAdminActor();
        return {
            authenticated: true,
            username: actor.username,
            user: actor.user,
            role: actor.role,
            permissions: actor.permissions,
            localAuthConfigured: await hasAnyWorkerUsersAfterSchema(env),
        };
    }

    await ensureUserAuthSchema(env);
    const usersConfigured = await hasAnyWorkerUsers(env);
    const actor = usersConfigured ? await verifyWorkerAuthSessionToken(suppliedToken, env) : null;
    if (actor) {
        return {
            authenticated: true,
            username: actor.username,
            user: actor.user,
            role: actor.role,
            permissions: actor.permissions,
            localAuthConfigured: true,
        };
    }

    if (!usersConfigured && await isCloudflareAccessAdminRequest(request, env)) {
        const actor = buildBootstrapAdminActor();
        return {
            authenticated: true,
            username: actor.username,
            user: actor.user,
            role: actor.role,
            permissions: actor.permissions,
            localAuthConfigured: false,
        };
    }

    return {
        authenticated: false,
        username: null,
        user: null,
        role: null,
        permissions: [],
        localAuthConfigured: usersConfigured,
    };
}

async function hasAnyWorkerUsersAfterSchema(env) {
    await ensureUserAuthSchema(env);
    return await hasAnyWorkerUsers(env);
}

async function saveWorkerAuthUser(env, body, actor) {
    await ensureUserAuthSchema(env);
    const usersConfigured = await hasAnyWorkerUsers(env);
    const currentPassword = String(body?.currentPassword || "");
    const newPassword = String(body?.newPassword || body?.password || "");
    assertWorkerPasswordStrength(newPassword);

    if (!usersConfigured) {
        const username = String(body?.username || "").trim();
        if (!username) {
            throw httpError(400, "Username is required");
        }
        const createdUser = await createFirstAdminUser(env, {
            username,
            password: newPassword,
        }, actor);
        const token = await createWorkerAuthSessionToken(env, createdUser, WORKER_AUTH_SESSION_TTL_SECONDS);
        return buildAuthSuccessResponse(createdUser, token, "Local admin login saved");
    }

    const targetUser = await resolveSelfManagedUser(env, actor, body);
    if (!await verifyWorkerAuthPassword(currentPassword, parseStoredPassword(targetUser.password_json))) {
        throw httpError(401, "authIncorrectCreds");
    }

    const nextUsername = String(body?.username || targetUser.username || "").trim();
    if (!nextUsername) {
        throw httpError(400, "Username is required");
    }
    if (nextUsername.toLowerCase() !== targetUser.username.toLowerCase()) {
        await assertUsernameAvailable(env, nextUsername, targetUser.id);
    }

    await revokeUserSessions(env, targetUser.id);
    const passwordJson = await hashWorkerAuthPassword(newPassword);
    await env.DB.prepare(
        `UPDATE users
         SET username = ?, password_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(nextUsername, JSON.stringify(passwordJson), targetUser.id)
        .run();
    const updatedUser = await getUserById(env, targetUser.id);
    await logUserAudit(env, actor, updatedUser.id, "user.password.self", { username: updatedUser.username });
    const token = await createWorkerAuthSessionToken(env, updatedUser, WORKER_AUTH_SESSION_TTL_SECONDS);
    return buildAuthSuccessResponse(updatedUser, token, "Local admin login saved");
}

async function logoutWorkerAuthSession(request, env) {
    await ensureUserAuthSchema(env);
    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const session = await verifyWorkerAuthSessionToken(suppliedToken, env);
    if (session?.sessionId) {
        await revokeWorkerAuthSession(env, session);
    }
    return { ok: true };
}

async function loginWorkerAuthUser(env, body) {
    await ensureUserAuthSchema(env);
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    const oneTimeToken = String(body?.token || "").trim();
    const authUser = await getUserByUsername(env, username);
    if (
        !authUser ||
        !authUser.active ||
        !await verifyWorkerAuthPassword(password, parseStoredPassword(authUser.password_json))
    ) {
        throw httpError(401, "authIncorrectCreds");
    }

    const twoFA = parseUserTotp(authUser.totp_json);
    if (twoFA?.enabled) {
        if (!oneTimeToken) {
            return { tokenRequired: true };
        }
        if (twoFA.lastToken === oneTimeToken || !await verifyWorkerTotpCode(twoFA.secret, oneTimeToken)) {
            return {
                ok: false,
                msg: "authInvalidToken",
                msgi18n: true,
            };
        }
        await updateUserTotp(env, authUser.id, {
            ...twoFA,
            lastToken: oneTimeToken,
            updatedAt: new Date().toISOString(),
        });
    }

    const ttlSeconds = body?.remember ? WORKER_AUTH_REMEMBER_SESSION_TTL_SECONDS : WORKER_AUTH_SESSION_TTL_SECONDS;
    const token = await createWorkerAuthSessionToken(env, authUser, ttlSeconds);
    await env.DB.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(authUser.id)
        .run();
    return buildAuthSuccessResponse(authUser, token);
}

async function getWorkerTwoFAStatus(env, actor) {
    const user = await resolveSelfManagedUser(env, actor);
    const twoFA = parseUserTotp(user.totp_json);
    return {
        ok: true,
        status: Boolean(twoFA?.enabled),
    };
}

async function prepareWorkerTwoFA(env, body, actor) {
    const user = await requireSelfManagedUserPassword(env, body?.currentPassword, actor, body);
    const twoFA = parseUserTotp(user.totp_json);
    if (twoFA?.enabled) {
        return {
            ok: false,
            msg: "2faAlreadyEnabled",
            msgi18n: true,
        };
    }

    const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
    await updateUserTotp(env, user.id, {
        secret,
        enabled: false,
        lastToken: null,
        verified: false,
        updatedAt: new Date().toISOString(),
    });

    return {
        ok: true,
        uri: buildWorkerTotpUri(user.username, secret),
    };
}

async function verifyWorkerTwoFAToken(env, body, actor) {
    const user = await requireSelfManagedUserPassword(env, body?.currentPassword, actor, body);
    const twoFA = parseUserTotp(user.totp_json);
    const token = String(body?.token || "").trim();
    if (!twoFA?.secret || twoFA.lastToken === token || !await verifyWorkerTotpCode(twoFA.secret, token)) {
        return {
            ok: false,
            msg: "authInvalidToken",
            msgi18n: true,
            valid: false,
        };
    }
    await updateUserTotp(env, user.id, {
        ...twoFA,
        verified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    });
    return {
        ok: true,
        valid: true,
    };
}

async function saveWorkerTwoFA(env, body, actor) {
    const user = await requireSelfManagedUserPassword(env, body?.currentPassword, actor, body);
    const twoFA = parseUserTotp(user.totp_json);
    if (!twoFA?.secret) {
        throw httpError(400, "2FA has not been prepared");
    }
    if (!twoFA.verified) {
        throw httpError(400, "authInvalidToken");
    }
    await updateUserTotp(env, user.id, {
        ...twoFA,
        enabled: true,
        verified: false,
        updatedAt: new Date().toISOString(),
    });
    return {
        ok: true,
        msg: "2faEnabled",
        msgi18n: true,
    };
}

async function disableWorkerTwoFA(env, body, actor) {
    const user = await requireSelfManagedUserPassword(env, body?.currentPassword, actor, body);
    await updateUserTotp(env, user.id, {
        secret: null,
        enabled: false,
        lastToken: null,
        verified: false,
        updatedAt: new Date().toISOString(),
    });
    return {
        ok: true,
        msg: "2faDisabled",
        msgi18n: true,
    };
}

async function listUsers(env) {
    await ensureUserAuthSchema(env);
    const result = await env.DB.prepare(
        `SELECT id, username, display_name, role, active, created_at, updated_at, last_login_at
         FROM users
         ORDER BY username COLLATE NOCASE`
    ).all();
    return (result.results || []).map(serializePublicUser);
}

async function requireUserForResponse(env, userId) {
    const user = await getUserById(env, userId);
    if (!user) {
        throw httpError(404, "User not found");
    }
    return serializePublicUser(user);
}

async function createUser(env, body, actor) {
    await ensureUserAuthSchema(env);
    const username = String(body?.username || "").trim();
    const displayName = normalizeOptionalString(body?.displayName ?? body?.display_name);
    const role = normalizeUserRole(body?.role || "viewer");
    const password = String(body?.password || body?.newPassword || "");
    const active = body?.active === undefined ? true : Boolean(body.active);
    if (!username) {
        throw httpError(400, "Username is required");
    }
    assertWorkerPasswordStrength(password);
    await assertUsernameAvailable(env, username);
    const passwordJson = await hashWorkerAuthPassword(password);
    const result = await env.DB.prepare(
        `INSERT INTO users (username, display_name, role, password_json, totp_json, active)
         VALUES (?, ?, ?, ?, NULL, ?)`
    )
        .bind(username, displayName, role, JSON.stringify(passwordJson), active ? 1 : 0)
        .run();
    const userId = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    const user = await getUserById(env, userId);
    await logUserAudit(env, actor, user.id, "user.create", { username, role, active });
    return serializePublicUser(user);
}

async function updateUser(env, userId, body, actor) {
    await ensureUserAuthSchema(env);
    const existing = await getUserById(env, userId);
    if (!existing) {
        throw httpError(404, "User not found");
    }
    const username = String(body?.username || existing.username).trim();
    const displayName = Object.prototype.hasOwnProperty.call(body || {}, "displayName")
        || Object.prototype.hasOwnProperty.call(body || {}, "display_name")
        ? normalizeOptionalString(body?.displayName ?? body?.display_name)
        : existing.display_name;
    const role = normalizeUserRole(body?.role || existing.role);
    const active = body?.active === undefined ? Boolean(existing.active) : Boolean(body.active);
    if (!username) {
        throw httpError(400, "Username is required");
    }
    if (username.toLowerCase() !== existing.username.toLowerCase()) {
        await assertUsernameAvailable(env, username, existing.id);
    }
    if (wouldRemoveActiveAdmin(existing, { role, active })) {
        await assertCanRemoveActiveAdmin(env, existing.id);
    }
    await env.DB.prepare(
        `UPDATE users
         SET username = ?, display_name = ?, role = ?, active = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(username, displayName, role, active ? 1 : 0, existing.id)
        .run();
    if (!active) {
        await revokeUserSessions(env, existing.id);
    }
    const updated = await getUserById(env, existing.id);
    await logUserAudit(env, actor, updated.id, "user.update", { username, role, active });
    return serializePublicUser(updated);
}

async function deleteUser(env, userId, actor) {
    await ensureUserAuthSchema(env);
    const existing = await getUserById(env, userId);
    if (!existing) {
        throw httpError(404, "User not found");
    }
    if (existing.active && existing.role === "admin") {
        await assertCanRemoveActiveAdmin(env, existing.id);
    }
    await revokeUserSessions(env, existing.id);
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(existing.id).run();
    await logUserAudit(env, actor, existing.id, "user.delete", { username: existing.username, role: existing.role });
}

async function setUserPassword(env, userId, body, actor) {
    await ensureUserAuthSchema(env);
    const existing = await getUserById(env, userId);
    if (!existing) {
        throw httpError(404, "User not found");
    }
    const password = String(body?.password || body?.newPassword || "");
    assertWorkerPasswordStrength(password);
    const passwordJson = await hashWorkerAuthPassword(password);
    await revokeUserSessions(env, existing.id);
    await env.DB.prepare(
        `UPDATE users
         SET password_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(JSON.stringify(passwordJson), existing.id)
        .run();
    await logUserAudit(env, actor, existing.id, "user.password.admin", { username: existing.username });
}

async function resetUserTwoFA(env, userId, actor) {
    await ensureUserAuthSchema(env);
    const existing = await getUserById(env, userId);
    if (!existing) {
        throw httpError(404, "User not found");
    }
    await updateUserTotp(env, existing.id, null);
    await logUserAudit(env, actor, existing.id, "user.2fa.reset", { username: existing.username });
}

async function ensureUserAuthSchema(env) {
    let ready = userAuthSchemaReady.get(env.DB);
    if (!ready) {
        ready = (async () => {
            for (const sql of USER_AUTH_SCHEMA_SQL) {
                await env.DB.prepare(sql).run();
            }
            await migrateLegacyWorkerAuthUser(env);
        })();
        userAuthSchemaReady.set(env.DB, ready);
    }

    try {
        await ready;
    } catch (error) {
        userAuthSchemaReady.delete(env.DB);
        throw error;
    }
}

async function migrateLegacyWorkerAuthUser(env) {
    if (await hasAnyWorkerUsers(env)) {
        return;
    }
    const legacyAuthUser = await getStoredSetting(env, WORKER_AUTH_USER_SETTING);
    if (
        !legacyAuthUser ||
        typeof legacyAuthUser.username !== "string" ||
        !legacyAuthUser.password ||
        legacyAuthUser.password.algorithm !== "PBKDF2-SHA256"
    ) {
        return;
    }
    const username = legacyAuthUser.username.trim();
    if (!username) {
        return;
    }
    const legacyTotp = await getStoredSetting(env, WORKER_AUTH_TOTP_SETTING);
    const result = await env.DB.prepare(
        `INSERT INTO users (username, display_name, role, password_json, totp_json, active)
         VALUES (?, NULL, 'admin', ?, ?, 1)`
    )
        .bind(
            username,
            JSON.stringify(legacyAuthUser.password),
            legacyTotp ? JSON.stringify(legacyTotp) : null
        )
        .run();
    const userId = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    await logUserAudit(env, null, userId, "user.legacy_migrate", { username });
}

async function hasAnyWorkerUsers(env) {
    const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM users").first();
    return Number(row?.count || 0) > 0;
}

async function createFirstAdminUser(env, body, actor) {
    const username = String(body?.username || "").trim();
    const password = String(body?.password || body?.newPassword || "");
    if (!username) {
        throw httpError(400, "Username is required");
    }
    assertWorkerPasswordStrength(password);
    await assertUsernameAvailable(env, username);
    const passwordJson = await hashWorkerAuthPassword(password);
    const result = await env.DB.prepare(
        `INSERT INTO users (username, display_name, role, password_json, totp_json, active)
         VALUES (?, NULL, 'admin', ?, NULL, 1)`
    )
        .bind(username, JSON.stringify(passwordJson))
        .run();
    const userId = Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
    const user = await getUserById(env, userId);
    await logUserAudit(env, actor, user.id, "user.bootstrap", { username });
    return user;
}

async function getUserByUsername(env, username) {
    await ensureUserAuthSchema(env);
    const row = await env.DB.prepare(
        `SELECT id, username, display_name, role, password_json, totp_json, active, created_at, updated_at, last_login_at
         FROM users
         WHERE lower(username) = lower(?)
         LIMIT 1`
    )
        .bind(username)
        .first();
    return row ? normalizeUserRow(row) : null;
}

async function getUserById(env, userId) {
    await ensureUserAuthSchema(env);
    const row = await env.DB.prepare(
        `SELECT id, username, display_name, role, password_json, totp_json, active, created_at, updated_at, last_login_at
         FROM users
         WHERE id = ?
         LIMIT 1`
    )
        .bind(Number(userId))
        .first();
    return row ? normalizeUserRow(row) : null;
}

async function assertUsernameAvailable(env, username, exceptUserId = null) {
    const existing = await getUserByUsername(env, username);
    if (existing && Number(existing.id) !== Number(exceptUserId)) {
        throw httpError(400, "Username already exists");
    }
}

async function assertCanRemoveActiveAdmin(env, userId) {
    const row = await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE role = 'admin'
           AND active = 1
           AND id != ?`
    )
        .bind(Number(userId))
        .first();
    if (Number(row?.count || 0) <= 0) {
        throw httpError(400, "Cannot remove the last active admin");
    }
}

function wouldRemoveActiveAdmin(existing, next) {
    return existing.active && existing.role === "admin" && (!next.active || next.role !== "admin");
}

async function resolveSelfManagedUser(env, actor, body = {}) {
    if (actor?.id) {
        const user = await getUserById(env, actor.id);
        if (!user || !user.active) {
            throw httpError(401, "Unauthorized");
        }
        return user;
    }
    if (actor?.systemAdmin) {
        const username = String(body?.username || "").trim();
        if (username) {
            const user = await getUserByUsername(env, username);
            if (!user) {
                throw httpError(404, "User not found");
            }
            return user;
        }
        const result = await env.DB.prepare(
            `SELECT id, username, display_name, role, password_json, totp_json, active, created_at, updated_at, last_login_at
             FROM users
             ORDER BY id
             LIMIT 2`
        ).all();
        const users = (result.results || []).map(normalizeUserRow);
        if (users.length === 1) {
            return users[0];
        }
        throw httpError(400, "Username is required");
    }
    throw httpError(401, "Unauthorized");
}

async function requireSelfManagedUserPassword(env, currentPassword, actor, body = {}) {
    const user = await resolveSelfManagedUser(env, actor, body);
    if (!await verifyWorkerAuthPassword(String(currentPassword || ""), parseStoredPassword(user.password_json))) {
        throw httpError(401, "authIncorrectCreds");
    }
    return user;
}

async function updateUserTotp(env, userId, value) {
    await env.DB.prepare(
        `UPDATE users
         SET totp_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(value ? JSON.stringify(value) : null, Number(userId))
        .run();
}

async function logUserAudit(env, actor, userId, action, details = null) {
    await env.DB.prepare(
        `INSERT INTO user_audit_log (actor_user_id, user_id, action, details_json)
         VALUES (?, ?, ?, ?)`
    )
        .bind(
            actor?.id || null,
            userId || null,
            action,
            details ? JSON.stringify(details) : null
        )
        .run();
}

function buildAuthSuccessResponse(user, token, msg = undefined) {
    return {
        ok: true,
        ...(msg ? { msg } : {}),
        token,
        username: user.username,
        user: serializePublicUser(user),
        role: user.role,
        permissions: getRolePermissions(user.role),
        localAuthConfigured: true,
    };
}

function buildSystemAdminActor() {
    return {
        id: null,
        username: "System Admin",
        role: "admin",
        permissions: getRolePermissions("admin"),
        user: {
            id: null,
            username: "System Admin",
            role: "admin",
            active: true,
            system: true,
        },
        systemAdmin: true,
    };
}

function buildBootstrapAdminActor() {
    return {
        id: null,
        username: "Cloudflare",
        role: "admin",
        permissions: getRolePermissions("admin"),
        user: {
            id: null,
            username: "Cloudflare",
            role: "admin",
            active: true,
            bootstrap: true,
        },
        bootstrap: true,
    };
}

function actorHasPermission(actor, permission) {
    return actor?.role === "admin" || actor?.permissions?.includes(permission);
}

function getRolePermissions(role) {
    return [...new Set(ROLE_PERMISSIONS[role] || [])]
        .filter((permission) => ALL_PERMISSION_SET.has(permission))
        .sort();
}

function normalizeUserRole(role) {
    const normalized = String(role || "viewer").trim().toLowerCase();
    if (!VALID_USER_ROLES.has(normalized)) {
        throw httpError(400, "Invalid role");
    }
    return normalized;
}

function normalizeOptionalString(value) {
    if (value == null) {
        return null;
    }
    const normalized = String(value).trim();
    return normalized || null;
}

function assertWorkerPasswordStrength(password) {
    if (String(password || "").length < 6) {
        throw httpError(400, "passwordTooWeak");
    }
}

function normalizeUserRow(row) {
    return {
        id: Number(row.id),
        username: row.username,
        display_name: row.display_name ?? null,
        role: normalizeUserRole(row.role),
        password_json: row.password_json,
        totp_json: row.totp_json ?? null,
        active: Boolean(row.active),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
        last_login_at: row.last_login_at ?? null,
    };
}

function serializePublicUser(row) {
    const user = row?.id == null ? row : normalizeUserRow(row);
    return {
        id: user.id,
        username: user.username,
        displayName: user.display_name ?? null,
        role: user.role,
        active: Boolean(user.active),
        permissions: getRolePermissions(user.role),
        createdAt: user.created_at ?? null,
        updatedAt: user.updated_at ?? null,
        lastLoginAt: user.last_login_at ?? null,
    };
}

function parseStoredPassword(value) {
    if (!value) {
        return null;
    }
    if (typeof value === "object") {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function parseUserTotp(value) {
    if (!value) {
        return null;
    }
    if (typeof value === "object") {
        return typeof value.secret === "string" ? value : null;
    }
    try {
        const parsed = JSON.parse(value);
        return typeof parsed?.secret === "string" ? parsed : null;
    } catch (_) {
        return null;
    }
}

function hasConfiguredAdminApiToken(env) {
    return Boolean(env.ADMIN_API_TOKEN && typeof env.ADMIN_API_TOKEN === "string");
}

function isAdminApiToken(env, suppliedToken) {
    const expectedToken = env.ADMIN_API_TOKEN;
    return Boolean(
        expectedToken &&
        typeof expectedToken === "string" &&
        timingSafeEqual(suppliedToken, expectedToken)
    );
}

async function getStoredSetting(env, key) {
    const row = await env.DB.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first();
    if (!row) {
        return null;
    }
    try {
        return JSON.parse(row.value);
    } catch (_) {
        return row.value;
    }
}

async function setStoredSetting(env, key, value) {
    await env.DB.prepare(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP`
    )
        .bind(key, JSON.stringify(value))
        .run();
}

async function hashWorkerAuthPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await deriveWorkerAuthPasswordHash(password, salt, WORKER_AUTH_PASSWORD_ITERATIONS);
    return {
        algorithm: "PBKDF2-SHA256",
        iterations: WORKER_AUTH_PASSWORD_ITERATIONS,
        salt: bytesToBase64Url(salt),
        hash: bytesToBase64Url(hash),
    };
}

async function verifyWorkerAuthPassword(password, storedPassword) {
    if (!storedPassword || storedPassword.algorithm !== "PBKDF2-SHA256") {
        return false;
    }
    const iterations = Number(storedPassword.iterations);
    if (!Number.isFinite(iterations) || iterations < 1 || iterations > WORKER_AUTH_PASSWORD_ITERATIONS) {
        return false;
    }
    const salt = base64UrlToBytes(storedPassword.salt || "");
    const expectedHash = base64UrlToBytes(storedPassword.hash || "");
    const suppliedHash = await deriveWorkerAuthPasswordHash(password, salt, iterations);
    return timingSafeBytesEqual(suppliedHash, expectedHash);
}

async function deriveWorkerAuthPasswordHash(password, salt, iterations) {
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
            iterations,
        },
        keyMaterial,
        256
    );
    return new Uint8Array(bits);
}

async function ensureWorkerAuthSessionSecret(env) {
    const existing = await getStoredSetting(env, WORKER_AUTH_SESSION_SECRET_SETTING);
    if (typeof existing === "string" && existing.length > 0) {
        return existing;
    }
    const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await setStoredSetting(env, WORKER_AUTH_SESSION_SECRET_SETTING, secret);
    return secret;
}

async function rotateWorkerAuthSessionSecret(env) {
    const secret = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    await setStoredSetting(env, WORKER_AUTH_SESSION_SECRET_SETTING, secret);
    await setStoredSetting(env, WORKER_AUTH_REVOKED_SESSIONS_SETTING, {});
    return secret;
}

async function createWorkerAuthSessionToken(env, user, ttlSeconds) {
    await ensureUserAuthSchema(env);
    const sessionId = crypto.randomUUID
        ? crypto.randomUUID()
        : bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
        typ: "worker-session",
        userId: user.id,
        username: user.username,
        jti: sessionId,
        exp,
    })));
    const signature = await signWorkerAuthSession(`${header}.${payload}`, await ensureWorkerAuthSessionSecret(env));
    const token = `${header}.${payload}.${signature}`;
    await env.DB.prepare(
        `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
    )
        .bind(sessionId, Number(user.id), await hashWorkerAuthSessionToken(token), new Date(exp * 1000).toISOString())
        .run();
    return token;
}

async function verifyWorkerAuthSessionToken(token, env) {
    await ensureUserAuthSchema(env);
    if (!token || typeof token !== "string") {
        return null;
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }
    try {
        const header = decodeJwtPart(parts[0]);
        if (header.alg !== "HS256") {
            return null;
        }
        const expectedSignature = await signWorkerAuthSession(`${parts[0]}.${parts[1]}`, await ensureWorkerAuthSessionSecret(env));
        if (!timingSafeEqual(parts[2], expectedSignature)) {
            return null;
        }
        const payload = decodeJwtPart(parts[1]);
        if (payload.typ !== "worker-session" || typeof payload.username !== "string" || !jwtTimeIsValid(payload)) {
            return null;
        }
        const session = await getStoredUserSession(env, payload, await hashWorkerAuthSessionToken(token));
        if (!session || session.revoked_at || parseSqliteDateTime(session.expires_at) <= Date.now()) {
            return null;
        }
        const authUser = await getUserById(env, session.user_id);
        if (!authUser || !authUser.active) {
            return null;
        }
        await env.DB.prepare("UPDATE user_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
            .bind(session.id)
            .run();
        return buildLocalUserActor(authUser, session);
    } catch (_) {
        return null;
    }
}

async function getStoredUserSession(env, payload, tokenHash) {
    const sessionId = typeof payload?.jti === "string" ? payload.jti : "";
    if (!sessionId) {
        return null;
    }
    return await env.DB.prepare(
        `SELECT id, user_id, token_hash, expires_at, revoked_at, created_at, last_seen_at
         FROM user_sessions
         WHERE id = ?
           AND token_hash = ?
         LIMIT 1`
    )
        .bind(sessionId, tokenHash)
        .first();
}

async function revokeWorkerAuthSession(env, actor) {
    if (!actor?.sessionId) {
        return;
    }
    await env.DB.prepare(
        `UPDATE user_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(actor.sessionId)
        .run();
}

async function revokeUserSessions(env, userId) {
    await env.DB.prepare(
        `UPDATE user_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND revoked_at IS NULL`
    )
        .bind(Number(userId))
        .run();
}

function buildLocalUserActor(user, session) {
    return {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: getRolePermissions(user.role),
        user: serializePublicUser(user),
        sessionId: session.id,
    };
}

async function hashWorkerAuthSessionToken(token) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    return bytesToBase64Url(new Uint8Array(digest));
}

async function signWorkerAuthSession(data, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        base64UrlToBytes(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    return bytesToBase64Url(new Uint8Array(signature));
}

async function verifyWorkerTotpCode(secret, token, now = Date.now()) {
    if (!/^\d{6}$/.test(token || "")) {
        return false;
    }
    const counter = Math.floor(now / 1000 / WORKER_AUTH_TOTP_PERIOD_SECONDS);
    for (let offset = -WORKER_AUTH_TOTP_WINDOW; offset <= WORKER_AUTH_TOTP_WINDOW; offset++) {
        const expected = await generateWorkerTotpCode(secret, counter + offset);
        if (timingSafeEqual(token, expected)) {
            return true;
        }
    }
    return false;
}

async function generateWorkerTotpCode(secret, counter) {
    const key = await crypto.subtle.importKey(
        "raw",
        base32Decode(secret),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );
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

function buildWorkerTotpUri(username, secret) {
    const issuer = "Uptime Worker";
    const label = encodeURIComponent(`${issuer}:${username}`).replace("%3A", ":");
    const params = new URLSearchParams({
        secret,
        issuer,
    });
    return `otpauth://totp/${label}?${params.toString()}`;
}

function base32Encode(bytes) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    let output = "";
    for (const byte of bytes) {
        bits += byte.toString(2).padStart(8, "0");
        while (bits.length >= 5) {
            output += alphabet[Number.parseInt(bits.slice(0, 5), 2)];
            bits = bits.slice(5);
        }
    }
    if (bits.length > 0) {
        output += alphabet[Number.parseInt(bits.padEnd(5, "0"), 2)];
    }
    return output;
}

function base32Decode(value) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "";
    for (const char of String(value || "").toUpperCase().replace(/=+$/g, "")) {
        const index = alphabet.indexOf(char);
        if (index === -1) {
            throw httpError(400, "Invalid 2FA secret");
        }
        bits += index.toString(2).padStart(5, "0");
    }

    const bytes = [];
    for (let index = 0; index + 8 <= bits.length; index += 8) {
        bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
    }
    return new Uint8Array(bytes);
}

function timingSafeBytesEqual(left, right) {
    const maxLength = Math.max(left.length, right.length);
    let diff = left.length ^ right.length;
    for (let index = 0; index < maxLength; index++) {
        diff |= (left[index] || 0) ^ (right[index] || 0);
    }
    return diff === 0;
}

function timingSafeEqual(left, right) {
    if (typeof left !== "string" || typeof right !== "string") {
        return false;
    }
    const maxLength = Math.max(left.length, right.length);
    let diff = left.length ^ right.length;
    for (let index = 0; index < maxLength; index++) {
        diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
    }
    return diff === 0;
}

async function isCloudflareAccessAdminRequest(request, env) {
    const teamDomain = normalizeAccessTeamDomain(env.CF_ACCESS_TEAM_DOMAIN || env.TEAM_DOMAIN);
    const audience = env.CF_ACCESS_AUD || env.POLICY_AUD;
    const token = request.headers.get("cf-access-jwt-assertion");
    if (!teamDomain || !audience || !token) {
        return false;
    }

    try {
        const parts = token.split(".");
        if (parts.length !== 3) {
            return false;
        }

        const header = decodeJwtPart(parts[0]);
        if (header.alg !== "RS256" || !header.kid) {
            return false;
        }

        const jwks = await getCloudflareAccessJwks(teamDomain, env);
        const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === "RSA");
        if (!jwk) {
            return false;
        }

        const key = await crypto.subtle.importKey(
            "jwk",
            jwk,
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            false,
            ["verify"]
        );
        const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
        const verified = await crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            key,
            base64UrlToBytes(parts[2]),
            signedData
        );
        if (!verified) {
            return false;
        }

        const payload = decodeJwtPart(parts[1]);
        return (
            payload.iss === teamDomain &&
            jwtAudienceMatches(payload.aud, audience) &&
            jwtTimeIsValid(payload)
        );
    } catch (_) {
        return false;
    }
}

function normalizeAccessTeamDomain(teamDomain) {
    if (!teamDomain || typeof teamDomain !== "string") {
        return "";
    }
    const normalized = teamDomain.trim().replace(/\/+$/, "");
    if (!normalized) {
        return "";
    }
    return normalized.startsWith("https://") ? normalized : `https://${normalized}`;
}

async function getCloudflareAccessJwks(teamDomain, env) {
    if (env.CF_ACCESS_CERTS_JSON) {
        return JSON.parse(env.CF_ACCESS_CERTS_JSON);
    }

    const cached = accessCertCache.get(teamDomain);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.jwks;
    }

    const timeoutMs = resolveAccessCertLookupTimeoutMs(env);
    const response = await fetchWithTimeout(`${teamDomain}/cdn-cgi/access/certs`, timeoutMs);
    if (!response.ok) {
        throw new Error(`Cloudflare Access cert lookup failed with HTTP ${response.status}`);
    }
    const jwks = await response.json();
    accessCertCache.set(teamDomain, {
        jwks,
        expiresAt: Date.now() + ACCESS_CERT_CACHE_TTL_MS,
    });
    return jwks;
}

async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    let timeout = null;
    const responsePromise = fetch(url, {
        signal: controller.signal,
    });
    void responsePromise.catch(() => {});
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([
            responsePromise,
            timeoutPromise,
        ]);
    } finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}

function resolveAccessCertLookupTimeoutMs(env = {}) {
    const parsed = Number(env.CF_ACCESS_CERT_LOOKUP_TIMEOUT_MS);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_ACCESS_CERT_LOOKUP_TIMEOUT_MS;
    }
    return Math.min(30000, Math.max(1000, Math.round(parsed)));
}

function jwtAudienceMatches(tokenAudience, expectedAudience) {
    const expectedAudiences = normalizeExpectedAudiences(expectedAudience);
    if (Array.isArray(tokenAudience)) {
        return tokenAudience.some((audience) => expectedAudiences.has(audience));
    }
    return expectedAudiences.has(tokenAudience);
}

function normalizeExpectedAudiences(expectedAudience) {
    return new Set(
        String(expectedAudience || "")
            .split(/[,\s]+/)
            .map((audience) => audience.trim())
            .filter(Boolean)
    );
}

function jwtTimeIsValid(payload) {
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp <= now) {
        return false;
    }
    if (typeof payload.nbf === "number" && payload.nbf > now) {
        return false;
    }
    return true;
}

function decodeJwtPart(part) {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(part)));
}

function base64UrlToBytes(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

function bytesToBase64Url(bytes) {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function assertWorkerTargetAllowed(monitor, networkProfileId) {
    if (networkProfileId || monitor.type === "group") {
        return;
    }

    const host = getMonitorTargetHost(monitor);
    if (host && isPrivateWorkerHost(host)) {
        throw httpError(400, PRIVATE_WORKER_HOST_ERROR);
    }
}

function getMonitorTargetHost(monitor) {
    if (["http", "keyword", "json-query", "websocket-upgrade"].includes(monitor.type)) {
        try {
            return new URL(monitor.url).hostname;
        } catch (_) {
            return null;
        }
    }
    if (["ping", "port"].includes(monitor.type)) {
        return monitor.hostname || null;
    }
    return null;
}

function isPrivateWorkerHost(host) {
    const normalized = String(host || "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    if (
        normalized === "localhost" ||
        normalized.endsWith(".localhost") ||
        normalized === "metadata.google.internal"
    ) {
        return true;
    }

    const ipv4 = parseIPv4(normalized);
    if (ipv4) {
        const [a, b] = ipv4;
        return (
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    const ipv6 = normalized.replace(/^\[/, "").replace(/\]$/, "");
    return (
        ipv6 === "::1" ||
        ipv6 === "::" ||
        ipv6.startsWith("fc") ||
        ipv6.startsWith("fd") ||
        ipv6.startsWith("fe80:")
    );
}

function parseIPv4(host) {
    const parts = host.split(".");
    if (parts.length !== 4) {
        return null;
    }
    const octets = parts.map((part) => Number(part));
    if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return null;
    }
    return octets;
}

/**
 * Extract a monitor array from supported Uptime Kuma backup shapes.
 * @param {object|object[]} input Import payload.
 * @returns {object[]} Source monitor objects.
 */
function extractImportMonitors(input) {
    if (Array.isArray(input)) {
        return input;
    }
    if (!input || typeof input !== "object") {
        throw httpError(400, "Import payload must be a JSON object or monitor array");
    }
    if (input.backup) {
        return extractImportMonitors(input.backup);
    }
    if (input.monitorList) {
        return monitorCollectionToArray(input.monitorList);
    }
    if (input.monitors) {
        return monitorCollectionToArray(input.monitors);
    }
    throw httpError(400, "Import payload must include monitorList or monitors");
}

/**
 * Convert an array or object-keyed monitor collection into an array.
 * @param {object[]|object} collection Monitor collection from backup JSON.
 * @returns {object[]} Source monitor objects.
 */
function monitorCollectionToArray(collection) {
    if (Array.isArray(collection)) {
        return collection;
    }
    if (collection && typeof collection === "object") {
        return Object.values(collection);
    }
    throw httpError(400, "Monitor import list must be an array or object");
}

/**
 * Normalize the duplicate-name handling mode.
 * @param {string} value Raw import mode.
 * @returns {"skip"|"overwrite"} Normalized import mode.
 */
function normalizeImportHandle(value) {
    if (value === "overwrite") {
        return "overwrite";
    }
    return "skip";
}

/**
 * Add synthetic group monitor rows for Uptime Kuma exports that include path
 * metadata but omit matching group monitor rows.
 * @param {object[]} monitors Source monitor objects.
 * @returns {object[]} Original monitors plus derived groups.
 */
function expandImportMonitorsWithMissingGroups(monitors) {
    const expanded = [];
    const derivedGroupsByPath = new Map();
    const explicitGroupRefsByPath = new Map();
    const explicitGroupNames = new Map();
    const normalizedMonitors = monitors.map((monitor) => {
        if (monitor?.type !== "group") {
            return monitor;
        }

        const groupPath = extractImportFullPath(monitor);
        if (groupPath.length === 0) {
            return monitor;
        }

        const ref = normalizeImportSourceReference(monitor.id) || syntheticImportGroupId(groupPath);
        explicitGroupRefsByPath.set(importPathKey(groupPath), ref);
        explicitGroupNames.set(
            normalizeImportGroupName(groupPath[groupPath.length - 1]),
            groupPath[groupPath.length - 1]
        );

        if (monitor.id === ref) {
            return monitor;
        }
        return {
            ...monitor,
            id: ref,
        };
    });
    const sourceRefs = new Set(
        normalizedMonitors.map((monitor) => normalizeImportSourceReference(monitor?.id)).filter((ref) => ref != null)
    );

    const ensureGroup = (groupPath) => {
        const key = importPathKey(groupPath);
        const explicitRef = explicitGroupRefsByPath.get(key);
        if (explicitRef != null) {
            return explicitRef;
        }
        if (derivedGroupsByPath.has(key)) {
            return derivedGroupsByPath.get(key).id;
        }

        const parentPath = groupPath.slice(0, -1);
        const id = `derived-group:${key}`;
        const group = {
            id,
            name: groupPath[groupPath.length - 1],
            type: "group",
            active: 1,
            parent: parentPath.length > 0 ? ensureGroup(parentPath) : null,
            __derivedGroupPath: groupPath,
        };
        derivedGroupsByPath.set(key, group);
        expanded.push(group);
        return id;
    };

    for (const source of normalizedMonitors) {
        const explicitGroupPath = extractImportGroupPath(source);
        const groupPath = explicitGroupPath.length > 0
            ? explicitGroupPath
            : inferImportGroupPath(source, explicitGroupNames);
        let monitor = source;
        if (groupPath.length > 0) {
            const derivedParent = ensureGroup(groupPath);
            const sourceParent = normalizeImportSourceReference(source.parent);
            if (sourceParent == null || !sourceRefs.has(sourceParent)) {
                monitor = {
                    ...source,
                    parent: derivedParent,
                };
            }
        }
        expanded.push(monitor);
    }

    return expanded;
}

/**
 * Build the synthetic source ID used for explicit group rows that lack IDs.
 * @param {string[]} groupPath Group hierarchy path.
 * @returns {string} Stable synthetic source reference.
 */
function syntheticImportGroupId(groupPath) {
    return `derived-group:${importPathKey(groupPath)}`;
}

/**
 * Infer a group path for flat exports that contain group rows but no parent/path
 * metadata. These rules are intentionally conservative and only apply when the
 * matching group was present in the import payload.
 * @param {object} source Source monitor.
 * @param {Map<string, string>} explicitGroupNames Available group names by normalized name.
 * @returns {string[]} Inferred group path.
 */
function inferImportGroupPath(source, explicitGroupNames) {
    if (!source || source.type === "group" || normalizeImportSourceReference(source.parent) != null) {
        return [];
    }

    const name = String(source.name || "");
    const lowerName = name.toLowerCase();
    const type = String(source.type || "");
    const active = source.active === undefined ? true : normalizeBoolean(source.active);

    if (!active && explicitGroupNames.has("archive")) {
        return [explicitGroupNames.get("archive")];
    }
    if (/\bsecurity\s+check\b/i.test(name) && explicitGroupNames.has("security")) {
        return [explicitGroupNames.get("security")];
    }
    if (/\btime\s*clock\b/i.test(name) && explicitGroupNames.has("timeclock")) {
        return [explicitGroupNames.get("timeclock")];
    }
    if (/\b(printer|lexmark|kyocera|sfm(?:\.\d+)?)\b/i.test(name) && explicitGroupNames.has("printers")) {
        return [explicitGroupNames.get("printers")];
    }
    if (/\bnode\s*\d+\b/i.test(name) && explicitGroupNames.has("nodes")) {
        return [explicitGroupNames.get("nodes")];
    }
    if (/\b(internet|t-mobile|5g|comcast|123net|inseego|pcs)\b/i.test(name) && explicitGroupNames.has("internet")) {
        return [explicitGroupNames.get("internet")];
    }
    if (
        ["http", "keyword", "json-query", "websocket-upgrade"].includes(type) &&
        explicitGroupNames.has("websites")
    ) {
        return [explicitGroupNames.get("websites")];
    }
    if (["ping", "port"].includes(type) && explicitGroupNames.has("endpoints")) {
        return [explicitGroupNames.get("endpoints")];
    }
    if (lowerName.includes("endpoint") && explicitGroupNames.has("endpoints")) {
        return [explicitGroupNames.get("endpoints")];
    }

    return [];
}

/**
 * Build an index of existing group monitor rows by their full path.
 * @param {object[]} existingRows Existing monitor rows.
 * @param {object} relationshipData Existing monitor relationship data.
 * @returns {Map<string, object>} Existing group rows keyed by full path.
 */
function buildExistingGroupPathIndex(existingRows, relationshipData) {
    const existingGroupByPath = new Map();
    for (const monitor of existingRows) {
        if (monitor.type !== "group") {
            continue;
        }
        const path = relationshipData.paths.get(Number(monitor.id)) || [monitor.name || ""];
        existingGroupByPath.set(importPathKey(path), monitor);
    }
    return existingGroupByPath;
}

/**
 * Find an existing monitor row for the current import source.
 * @param {object} source Source monitor.
 * @param {Map<string, object>} existingByName Existing rows keyed by name.
 * @param {Map<string, object>} existingGroupByPath Existing group rows keyed by path.
 * @returns {object|undefined} Existing row if one should be reused/replaced.
 */
function findExistingImportMonitor(source, existingByName, existingGroupByPath) {
    if (source?.type === "group") {
        const groupPath = source.__derivedGroupPath || extractImportFullPath(source);
        if (groupPath.length > 0) {
            const byPath = existingGroupByPath.get(importPathKey(groupPath));
            if (byPath) {
                return byPath;
            }
            if (groupPath.length > 1) {
                return undefined;
            }
        }
    }
    return existingByName.get(String(source?.name || "").trim());
}

/**
 * Add a newly imported monitor to duplicate-detection indexes.
 * @param {Map<string, object>} existingByName Existing rows keyed by name.
 * @param {Map<string, object>} existingGroupByPath Existing group rows keyed by path.
 * @param {object} source Source monitor.
 * @param {object} monitor Imported monitor row.
 * @returns {void}
 */
function rememberExistingImportMonitor(existingByName, existingGroupByPath, source, monitor) {
    existingByName.set(monitor.name, monitor);
    if (monitor.type !== "group") {
        return;
    }
    const groupPath = source.__derivedGroupPath || extractImportFullPath(source);
    if (groupPath.length > 0) {
        existingGroupByPath.set(importPathKey(groupPath), monitor);
    }
}

/**
 * Remove a replaced monitor from duplicate-detection indexes.
 * @param {object} existing Existing monitor row.
 * @param {object} source Source monitor being imported.
 * @param {Map<string, object>} existingByName Existing rows keyed by name.
 * @param {Map<string, object>} existingGroupByPath Existing group rows keyed by path.
 * @returns {void}
 */
function removeExistingImportMonitor(existing, source, existingByName, existingGroupByPath) {
    const byName = existingByName.get(existing.name);
    if (byName && Number(byName.id) === Number(existing.id)) {
        existingByName.delete(existing.name);
    }
    if (existing.type !== "group") {
        return;
    }
    const groupPath = source.__derivedGroupPath || extractImportFullPath(source);
    if (groupPath.length > 0) {
        existingGroupByPath.delete(importPathKey(groupPath));
    }
}

/**
 * Extract the full hierarchy path from Uptime Kuma import metadata.
 * @param {object} source Source monitor.
 * @returns {string[]} Full path including the monitor name when available.
 */
function extractImportFullPath(source) {
    const path = normalizeImportPath(source?.path);
    if (path.length > 0) {
        return path;
    }

    const pathName = normalizeImportPathName(source?.pathName ?? source?.path_name);
    if (pathName.length > 0) {
        return pathName;
    }

    const parentName = normalizeImportPathSegment(
        source?.parentName ?? source?.parent_name ?? source?.groupName ?? source?.group_name
    );
    const name = String(source?.name || "").trim();
    if (parentName && name) {
        return [parentName, name];
    }

    if (source?.type === "group" && name) {
        return [name];
    }

    return [];
}

/**
 * Extract only the group portion of an imported monitor's full path.
 * @param {object} source Source monitor.
 * @returns {string[]} Group path.
 */
function extractImportGroupPath(source) {
    const fullPath = extractImportFullPath(source);
    if (fullPath.length === 0) {
        return [];
    }
    const name = String(source?.name || "").trim();
    if (name && fullPath[fullPath.length - 1] === name) {
        return fullPath.slice(0, -1);
    }
    return fullPath;
}

/**
 * Normalize path array metadata.
 * @param {unknown} value Raw path value.
 * @returns {string[]} Normalized path segments.
 */
function normalizeImportPath(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeImportPathSegment).filter(Boolean);
    }
    if (typeof value === "string") {
        return normalizeImportPathName(value);
    }
    return [];
}

/**
 * Normalize pathName-style metadata.
 * @param {unknown} value Raw pathName value.
 * @returns {string[]} Normalized path segments.
 */
function normalizeImportPathName(value) {
    if (typeof value !== "string") {
        return [];
    }
    return value.split(/\s*\/\s*/).map(normalizeImportPathSegment).filter(Boolean);
}

/**
 * Normalize one hierarchy path segment.
 * @param {unknown} value Raw segment.
 * @returns {string} Normalized segment.
 */
function normalizeImportPathSegment(value) {
    if (value && typeof value === "object" && "name" in value) {
        return String(value.name || "").trim();
    }
    return String(value || "").trim();
}

/**
 * Normalize a group name for fallback matching.
 * @param {unknown} value Raw group name.
 * @returns {string} Normalized group name.
 */
function normalizeImportGroupName(value) {
    return normalizeImportPathSegment(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Build a stable key for a monitor path.
 * @param {string[]} path Path segments.
 * @returns {string} Path key.
 */
function importPathKey(path) {
    return path.map((segment) => String(segment).trim()).filter(Boolean).join(" / ");
}

/**
 * Sort source monitors so parent groups are usually created before children.
 * @param {object[]} monitors Source monitors.
 * @returns {object[]} Sorted source monitors.
 */
function sortImportMonitorsByParent(monitors) {
    return [...monitors].sort((a, b) => {
        if (a.type === "group" && b.type !== "group") {
            return -1;
        }
        if (a.type !== "group" && b.type === "group") {
            return 1;
        }
        return 0;
    });
}

/**
 * Normalize JSON-ish Uptime Kuma monitor fields for Worker monitor creation.
 * @param {object} source Source monitor from backup JSON.
 * @param {object} importContext Import-wide defaults.
 * @returns {object} Monitor payload accepted by createMonitor.
 */
function normalizeImportedMonitor(source, importContext = {}) {
    const monitor = {
        ...source,
        networkProfileId: normalizeNetworkProfileId(source.networkProfileId ?? source.network_profile_id),
    };

    if (monitor.headers && typeof monitor.headers !== "string") {
        monitor.headers = JSON.stringify(monitor.headers);
    }
    if (monitor.body && typeof monitor.body !== "string") {
        monitor.body = JSON.stringify(monitor.body);
    }
    if (monitor.accepted_statuscodes) {
        monitor.accepted_statuscodes = normalizeAcceptedStatusCodes(monitor.accepted_statuscodes);
    }
    if (["ping", "port"].includes(monitor.type) && isPlaceholderUrl(monitor.url)) {
        monitor.url = null;
    }
    if (!monitor.networkProfileId && shouldUseImportPrivateNetworkProfile(monitor)) {
        monitor.networkProfileId = importContext.privateNetworkProfileId || null;
    }
    for (const field of BOOLEAN_IMPORT_FIELDS) {
        if (field in monitor) {
            monitor[field] = normalizeBoolean(monitor[field]);
        }
    }
    return monitor;
}

/**
 * Find the private-network profile to use for imported internal monitors.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<string|null>} Network profile ID when available.
 */
async function getImportPrivateNetworkProfileId(env) {
    const profile = await env.DB.prepare(
        "SELECT id FROM network_profiles WHERE enabled = 1 AND type = ? ORDER BY id LIMIT 1"
    )
        .bind("twingate")
        .first();
    return profile?.id || null;
}

/**
 * Check whether an imported monitor target should default to a private route.
 * @param {object} monitor Normalized import monitor.
 * @returns {boolean} True when the target is a private network address.
 */
function shouldUseImportPrivateNetworkProfile(monitor) {
    const host = getMonitorTargetHost(monitor);
    return isPrivateNetworkHost(host) || isPrivateNetworkHostname(host);
}

/**
 * Identify private network address ranges that can be reached through Twingate.
 * @param {string|null} host Monitor target hostname or IP.
 * @returns {boolean} True when host is private but not loopback/link-local/metadata.
 */
function isPrivateNetworkHost(host) {
    const normalized = String(host || "").trim().toLowerCase();
    const ipv4 = parseIPv4(normalized);
    if (ipv4) {
        const [a, b] = ipv4;
        return (
            a === 10 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168)
        );
    }

    const ipv6 = normalized.replace(/^\[/, "").replace(/\]$/, "");
    return ipv6.startsWith("fc") || ipv6.startsWith("fd");
}

function isPrivateNetworkHostname(host) {
    const normalized = String(host || "").trim().toLowerCase();
    if (!normalized || normalized.includes("://") || parseIPv4(normalized)) {
        return false;
    }

    return (
        !normalized.includes(".") ||
        normalized.endsWith(".home") ||
        normalized.endsWith(".internal") ||
        normalized.endsWith(".lan") ||
        normalized.endsWith(".local") ||
        normalized.endsWith(".wgs")
    );
}

/**
 * Track old-to-new ID mappings when source monitor IDs are present.
 * @param {Map<number|string, number>} importedIdBySourceId Source ID map.
 * @param {object} source Source monitor.
 * @param {number} monitorID New or existing monitor ID.
 * @returns {void}
 */
function rememberImportedSourceId(importedIdBySourceId, source, monitorID) {
    const sourceId = normalizeImportSourceReference(source.id);
    if (sourceId != null) {
        importedIdBySourceId.set(sourceId, monitorID);
    }
}

/**
 * Normalize accepted status codes from array, JSON string, or comma string input.
 * @param {string|string[]} value Raw accepted status code value.
 * @returns {string[]} Accepted status codes.
 */
function normalizeAcceptedStatusCodes(value) {
    if (Array.isArray(value)) {
        return value.map((statusCode) => String(statusCode));
    }
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
                return parsed.map((statusCode) => String(statusCode));
            }
        } catch (_) {}
        return value.split(",").map((statusCode) => statusCode.trim()).filter(Boolean);
    }
    return monitorConfigDefaults("http").accepted_statuscodes;
}

const BOOLEAN_IMPORT_FIELDS = [
    "active",
    "invertKeyword",
    "invert_keyword",
    "ignoreTls",
    "upsideDown",
    "expiryNotification",
    "domainExpiryNotification",
    "cacheBust",
    "ping_numeric",
    "retryOnlyOnStatusCodeFailure",
];

/**
 * Normalize a source parent/id field from a DB export.
 * @param {unknown} value Raw source ID value.
 * @returns {number|null} Numeric source ID or null.
 */
function normalizeImportParentId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Normalize source import references, including synthetic group IDs.
 * @param {unknown} value Raw source ID or parent reference.
 * @returns {number|string|null} Numeric source ID, synthetic source ID, or null.
 */
function normalizeImportSourceReference(value) {
    const numericId = normalizeImportParentId(value);
    if (numericId != null) {
        return numericId;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    return null;
}

/**
 * Normalize the persisted parent field.
 * @param {unknown} value Raw parent value.
 * @returns {number|null} Parent monitor ID or null.
 */
function normalizeMonitorParent(value) {
    if (value === undefined || value === null || value === "" || value === -1) {
        return null;
    }
    const id = Number(value);
    return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Identify placeholder URLs emitted by Uptime Kuma DB exports for non-HTTP monitors.
 * @param {string|null} value Exported URL value.
 * @returns {boolean} True when the URL is only a form placeholder.
 */
function isPlaceholderUrl(value) {
    return value === "https://" || value === "http://";
}

/**
 * Normalize Uptime Kuma SQLite boolean values into frontend booleans.
 * @param {unknown} value Raw boolean-ish value.
 * @returns {boolean} Normalized boolean.
 */
function normalizeBoolean(value) {
    if (typeof value === "string") {
        return value === "1" || value.toLowerCase() === "true";
    }
    return Boolean(value);
}

/**
 * Resolve the monitor TLS-ignore flag from Worker config JSON or legacy row fields.
 * @param {object} monitor Monitor database row.
 * @param {object} config Parsed config_json payload.
 * @returns {boolean} True when TLS/SSL validation errors should be ignored.
 */
function resolveMonitorIgnoreTls(monitor = {}, config = parseMonitorConfig(monitor.config_json)) {
    const values = [
        config.ignoreTls,
        monitor.ignoreTls,
        monitor.ignore_tls,
    ];
    for (const value of values) {
        if (value !== undefined && value !== null) {
            return normalizeBoolean(value);
        }
    }
    return false;
}

function normalizeRunnerResponseMaxLength(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 1024;
    }
    return Math.min(Math.trunc(parsed), WORKER_HEARTBEAT_RESPONSE_MAX_CHARS);
}

/**
 * Build the persisted edit-form configuration for fields outside runner columns.
 * @param {object} input Request body sent from the edit form.
 * @param {object} existing Existing monitor row from D1.
 * @param {object} normalized Normalized runner-column values.
 * @returns {string} JSON payload for the monitor config column.
 */
function monitorConfigJson(input, existing = {}, normalized = {}) {
    const config = {
        ...monitorConfigDefaults(normalized.type || input?.type || existing.type),
        ...parseMonitorConfig(existing.config_json),
        ...(input || {}),
        ...normalized,
    };

    for (const field of MONITOR_CONFIG_EXCLUDED_FIELDS) {
        delete config[field];
    }

    return JSON.stringify(config);
}

/**
 * Parse a stored monitor config payload.
 * @param {string|null} value Stored JSON string.
 * @returns {object} Parsed object, or an empty object for missing/invalid data.
 */
function parseMonitorConfig(value) {
    if (!value || typeof value !== "string") {
        return {};
    }
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

/**
 * Return form defaults expected by EditMonitor.vue for Worker-supported types.
 * @param {string} type Monitor type.
 * @returns {object} Default edit-form values.
 */
function monitorConfigDefaults(type) {
    return {
        maxretries: 0,
        retryInterval: 60,
        resendInterval: 0,
        retryOnlyOnStatusCodeFailure: false,
        accepted_statuscodes: type === "websocket-upgrade" ? ["1000"] : ["200-299"],
        ignoreTls: false,
        upsideDown: false,
        expiryNotification: false,
        domainExpiryNotification: true,
        cacheBust: false,
        maxredirects: 10,
        saveResponse: false,
        saveErrorResponse: true,
        responseMaxLength: 1024,
        ipFamily: null,
        authMethod: null,
        basic_auth_user: "",
        basic_auth_pass: "",
        oauth_auth_method: "client_secret_basic",
        oauth_client_id: "",
        oauth_client_secret: "",
        oauth_token_url: "",
        oauth_scopes: "",
        oauth_audience: "",
        wsIgnoreSecWebsocketAcceptHeader: false,
        wsSubprotocol: "",
        tlsCa: "",
        tlsCert: "",
        tlsKey: "",
        packetSize: 56,
        ping_count: 1,
        ping_numeric: true,
        ping_per_request_timeout: 2,
        smtpSecurity: "nostarttls",
        expectedTlsAlert: "none",
        jsonPathOperator: "==",
        description: "",
        parent: null,
    };
}

function workerStatusPageConfig() {
    return {
        id: 1,
        slug: "default",
        title: "Status Page",
        description: "",
        icon: "/icon.svg",
        theme: "auto",
        autoRefreshInterval: 300,
        published: true,
        showTags: false,
        domainNameList: [],
        customCSS: "",
        footerText: "",
        showPoweredBy: true,
        analyticsId: null,
        analyticsScriptUrl: null,
        analyticsType: null,
        showCertificateExpiry: false,
        showOnlyLastHeartbeat: false,
        rssTitle: "",
    };
}

async function getWorkerStatusPageConfig(env) {
    const stored = await getStoredSetting(env, WORKER_STATUS_PAGE_CONFIG_SETTING);
    return normalizeWorkerStatusPageConfig(stored);
}

function normalizeWorkerStatusPageConfig(config) {
    const defaults = workerStatusPageConfig();
    const normalized = {
        ...defaults,
        ...(config && typeof config === "object" ? config : {}),
        id: 1,
    };

    normalized.slug = normalizeWorkerStatusPageSlug(normalized.slug, defaults.slug);
    normalized.title = String(normalized.title || defaults.title);
    normalized.description = String(normalized.description || "");
    normalized.icon = String(normalized.icon || defaults.icon);
    normalized.theme = ["auto", "light", "dark"].includes(normalized.theme) ? normalized.theme : defaults.theme;
    const refreshInterval = Number(normalized.autoRefreshInterval);
    normalized.autoRefreshInterval = Number.isFinite(refreshInterval)
        ? Math.max(5, refreshInterval)
        : defaults.autoRefreshInterval;
    normalized.showTags = Boolean(normalized.showTags);
    normalized.domainNameList = Array.isArray(normalized.domainNameList) ? normalized.domainNameList : [];
    normalized.customCSS = String(normalized.customCSS || "");
    normalized.footerText = String(normalized.footerText || "");
    normalized.showPoweredBy = normalized.showPoweredBy !== false;
    normalized.analyticsId = normalized.analyticsId ?? null;
    normalized.analyticsScriptUrl = normalized.analyticsScriptUrl ?? null;
    normalized.analyticsType = ["google", "umami", "plausible", "matomo"].includes(normalized.analyticsType)
        ? normalized.analyticsType
        : null;
    normalized.showCertificateExpiry = Boolean(normalized.showCertificateExpiry);
    normalized.showOnlyLastHeartbeat = Boolean(normalized.showOnlyLastHeartbeat);
    normalized.rssTitle = String(normalized.rssTitle || "");

    return normalized;
}

async function getWorkerPublicGroupList(env, monitors) {
    const stored = await getStoredSetting(env, WORKER_STATUS_PAGE_PUBLIC_GROUP_LIST_SETTING);
    if (!Array.isArray(stored)) {
        return [
            {
                id: 1,
                name: "Services",
                weight: 1,
                monitorList: monitors.map((monitor) => toPublicStatusPageMonitor(monitor)),
            },
        ];
    }
    return hydrateWorkerPublicGroupList(stored, monitors);
}

function normalizeWorkerPublicGroupList(publicGroupList) {
    if (!Array.isArray(publicGroupList)) {
        return [];
    }

    return publicGroupList.map((group, index) => ({
        id: normalizePositiveInteger(group?.id) ?? index + 1,
        name: String(group?.name || (index === 0 ? "Services" : "Untitled Group")),
        weight: index + 1,
        monitorList: Array.isArray(group?.monitorList)
            ? group.monitorList
                .map((monitor) => ({
                    id: normalizePositiveInteger(monitor?.id),
                    sendUrl: monitor?.sendUrl === undefined ? undefined : Boolean(monitor.sendUrl),
                    url: typeof monitor?.url === "string" ? monitor.url : undefined,
                }))
                .filter((monitor) => monitor.id !== null)
            : [],
    }));
}

function normalizePositiveInteger(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

function hydrateWorkerPublicGroupList(publicGroupList, monitors) {
    const monitorsById = new Map(monitors.map((monitor) => [Number(monitor.id), monitor]));

    return normalizeWorkerPublicGroupList(publicGroupList).map((group, index) => ({
        id: group.id,
        name: group.name,
        weight: index + 1,
        monitorList: group.monitorList
            .map((publicMonitor) => {
                const monitor = monitorsById.get(Number(publicMonitor.id));
                return monitor ? toPublicStatusPageMonitor(monitor, publicMonitor) : null;
            })
            .filter(Boolean),
    }));
}

function normalizeWorkerStatusPageSlug(value, fallback = "default") {
    const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!slug || !WORKER_STATUS_PAGE_SLUG_PATTERN.test(slug)) {
        return fallback;
    }
    return slug;
}

function assertWorkerStatusPageInputSlug(value) {
    const slug = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (!slug) {
        throw httpError(400, "Status page slug is required");
    }
    if (!WORKER_STATUS_PAGE_SLUG_PATTERN.test(slug)) {
        throw httpError(400, "Status page slug can only contain letters, numbers, and hyphens");
    }
    return slug;
}

function assertWorkerStatusPageSlug(slug, config) {
    const routeSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    if (!WORKER_STATUS_PAGE_ALIAS_SLUGS.has(routeSlug) && routeSlug !== config.slug) {
        throw httpError(404, "Status Page Not Found");
    }
}

function toPublicStatusPageMonitor(monitor, options = {}) {
    const sendUrl = options.sendUrl === undefined ? Boolean(monitor.url) : Boolean(options.sendUrl);
    const url = options.url === undefined ? monitor.url : options.url;
    return {
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        url,
        active: monitor.active,
        tags: [],
        sendUrl,
    };
}

function calculateStatusPageUptime(heartbeats) {
    if (!heartbeats.length) {
        return 0;
    }
    const up = heartbeats.filter((heartbeat) => heartbeat.status === 1).length;
    return up / heartbeats.length;
}

function getActiveWorkerLeafMonitors(groupMonitor, monitorsById) {
    const result = [];

    for (const child of monitorsById.values()) {
        if (Number(child.parent) !== Number(groupMonitor.id)) {
            continue;
        }

        if (!child || child.active === false || child.active === 0) {
            continue;
        }

        if (child.type === "group") {
            result.push(...getActiveWorkerLeafMonitors(child, monitorsById));
        } else {
            result.push(child);
        }
    }

    return result;
}

function buildWorkerGroupHeartbeatList(groupMonitorId, childHeartbeatLists) {
    const maxLength = Math.max(0, ...childHeartbeatLists.map((list) => list.length));
    const result = [];

    for (let index = 0; index < maxLength; index++) {
        const offsetFromEnd = maxLength - index;
        const beats = childHeartbeatLists.map((list) => list[list.length - offsetFromEnd] || null);
        const usableBeats = beats.filter((beat) => beat && beat.status !== undefined && beat.status !== null);

        if (usableBeats.length === 0) {
            continue;
        }

        const latestBeat = usableBeats.reduce((latest, beat) => {
            if (!latest || new Date(beat.time) > new Date(latest.time)) {
                return beat;
            }
            return latest;
        }, null);

        result.push({
            monitorID: Number(groupMonitorId),
            status: calculateWorkerAggregateStatus(beats),
            ping: null,
            msg: "Group status",
            time: latestBeat?.time,
        });
    }

    return result;
}

function calculateWorkerAggregateStatus(beats) {
    let hasHeartbeat = false;
    let hasPending = false;

    for (const beat of beats) {
        if (!beat || beat.status === undefined || beat.status === null) {
            hasPending = true;
            continue;
        }

        hasHeartbeat = true;
        const status = Number(beat.status);

        if (status === MAINTENANCE) {
            return MAINTENANCE;
        }

        if (status === DOWN) {
            return DOWN;
        }

        if (status === PENDING) {
            hasPending = true;
        }
    }

    if (!hasHeartbeat) {
        return PENDING;
    }

    return hasPending ? PENDING : UP;
}

function monitorValues(monitor, includeActive, includeParent = true) {
    const values = [
        monitor.name,
        monitor.type,
        monitor.url,
        monitor.hostname,
        monitor.port,
        monitor.method,
        monitor.headers,
        monitor.body,
        monitor.keyword,
        monitor.invertKeyword,
        monitor.jsonPath,
        monitor.expectedValue,
        monitor.timeout,
        monitor.interval,
    ];
    if (includeActive) {
        values.push(monitor.active);
    }
    values.push(monitor.networkProfileId);
    if (includeParent) {
        values.push(monitor.parent);
    }
    return values;
}

function serializeMonitor(
    monitor,
    latestHeartbeat = null,
    relationshipData = buildMonitorRelationshipData([monitor]),
    tagsByMonitorId = new Map(),
    notificationsByMonitorId = new Map()
) {
    const name = monitor.name || "";
    const storedConfig = parseMonitorConfig(monitor.config_json);
    const config = {
        ...monitorConfigDefaults(monitor.type),
        ...storedConfig,
    };
    return {
        ...config,
        id: Number(monitor.id),
        name,
        type: monitor.type,
        url: monitor.url ?? null,
        hostname: monitor.hostname ?? null,
        port: monitor.port ?? null,
        method: monitor.method || "GET",
        headers: monitor.headers ?? null,
        body: monitor.body ?? null,
        keyword: monitor.keyword ?? null,
        invertKeyword: Boolean(monitor.invert_keyword ?? monitor.invertKeyword),
        jsonPath: monitor.json_path || monitor.jsonPath || "$",
        expectedValue: monitor.expected_value ?? monitor.expectedValue ?? null,
        timeout: Number(monitor.timeout || 30),
        interval: Number(monitor.interval || 60),
        active: monitor.active === undefined ? true : Boolean(monitor.active),
        parent: monitor.parent == null ? null : Number(monitor.parent),
        path: relationshipData.paths.get(Number(monitor.id)) || [name],
        pathName: (relationshipData.paths.get(Number(monitor.id)) || [name]).join(" / "),
        childrenIDs: relationshipData.childrenIDs.get(Number(monitor.id)) || [],
        tags: tagsByMonitorId.get(Number(monitor.id)) || [],
        notificationIDList: notificationsByMonitorId.get(Number(monitor.id)) || {},
        networkProfileId: monitor.network_profile_id ?? monitor.networkProfileId ?? null,
        proxyId: monitor.proxy_id == null ? null : Number(monitor.proxy_id),
        ignoreTls: resolveMonitorIgnoreTls(monitor, storedConfig),
        accepted_statuscodes: Array.isArray(config.accepted_statuscodes)
            ? config.accepted_statuscodes
            : monitorConfigDefaults(monitor.type).accepted_statuscodes,
        lastHeartbeat: latestHeartbeat ? serializeHeartbeat(latestHeartbeat, monitor) : null,
    };
}

function buildMonitorRelationshipData(monitors) {
    const monitorsById = new Map(monitors.map((monitor) => [Number(monitor.id), monitor]));
    const directChildren = new Map();
    const childrenIDs = new Map();
    const paths = new Map();

    for (const monitor of monitors) {
        const parent = normalizeMonitorParent(monitor.parent);
        if (parent != null) {
            if (!directChildren.has(parent)) {
                directChildren.set(parent, []);
            }
            directChildren.get(parent).push(Number(monitor.id));
        }
    }

    const collectChildren = (monitorId) => {
        if (childrenIDs.has(monitorId)) {
            return childrenIDs.get(monitorId);
        }
        const collected = [];
        for (const childId of directChildren.get(monitorId) || []) {
            collected.push(childId, ...collectChildren(childId));
        }
        childrenIDs.set(monitorId, collected);
        return collected;
    };

    const buildPath = (monitorId, seen = new Set()) => {
        if (paths.has(monitorId)) {
            return paths.get(monitorId);
        }
        const monitor = monitorsById.get(monitorId);
        if (!monitor || seen.has(monitorId)) {
            return [];
        }
        seen.add(monitorId);
        const parent = normalizeMonitorParent(monitor.parent);
        const path = parent != null
            ? [...buildPath(parent, seen), monitor.name || ""]
            : [monitor.name || ""];
        paths.set(monitorId, path);
        return path;
    };

    for (const monitor of monitors) {
        collectChildren(Number(monitor.id));
        buildPath(Number(monitor.id));
    }

    return { childrenIDs, paths };
}

async function isMissingColumn(env, table, column) {
    const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return !(info.results || []).some((row) => row.name === column);
}

function serializeHeartbeat(heartbeat, monitor = null) {
    return {
        monitorID: Number(heartbeat.monitor_id ?? heartbeat.monitorID),
        status: heartbeat.status_is_effective
            ? heartbeat.status
            : effectiveHeartbeatStatus(heartbeat.status, monitor),
        ping: heartbeat.ping,
        msg: heartbeat.msg,
        time: heartbeat.checked_at ?? heartbeat.time,
    };
}

function effectiveHeartbeatStatus(status, monitor) {
    if (!isUpsideDownMonitor(monitor)) {
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

function isUpsideDownMonitor(monitor) {
    if (!monitor) {
        return false;
    }
    if (monitor.upsideDown !== undefined) {
        return Boolean(monitor.upsideDown);
    }
    return Boolean(parseMonitorConfig(monitor.config_json).upsideDown);
}

function normalizeNetworkProfileId(value) {
    return value === undefined || value === "" || value === "direct" ? null : value;
}

function normalizeProxyId(value) {
    if (value === undefined || value === "" || value === "none") {
        return null;
    }
    const proxyId = Number(value);
    return Number.isInteger(proxyId) && proxyId > 0 ? proxyId : null;
}

function resolveMonitorProxyInput(input = {}, existing = {}) {
    if (Object.prototype.hasOwnProperty.call(input, "proxyId")) {
        return input.proxyId;
    }
    if (Object.prototype.hasOwnProperty.call(input, "proxy_id")) {
        return input.proxy_id;
    }
    return existing.proxy_id ?? existing.proxyId;
}

function resolveMonitorNetworkProfileInput(input = {}, existing = {}) {
    if (Object.prototype.hasOwnProperty.call(input, "networkProfileId")) {
        return input.networkProfileId;
    }
    if (Object.prototype.hasOwnProperty.call(input, "network_profile_id")) {
        return input.network_profile_id;
    }
    return existing.network_profile_id ?? existing.networkProfileId;
}

function hasProxySelection(input = {}) {
    return Object.prototype.hasOwnProperty.call(input, "proxyId")
        || Object.prototype.hasOwnProperty.call(input, "proxy_id");
}

function matchRoute(method, pathname) {
    if (method === "GET" && pathname === "/api/entry-page") {
        return { name: "entry-page", params: {} };
    }
    if (method === "GET" && pathname === "/api/health") {
        return { name: "health", params: {} };
    }
    if (method === "GET" && pathname === "/api/auth/session") {
        return { name: "auth-session", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/login") {
        return { name: "auth-login", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/logout") {
        return { name: "auth-logout", params: {} };
    }
    if (method === "PUT" && pathname === "/api/auth/local-user") {
        return { name: "auth-local-user", params: {} };
    }
    if (method === "GET" && pathname === "/api/auth/2fa/status") {
        return { name: "auth-2fa-status", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/2fa/prepare") {
        return { name: "auth-2fa-prepare", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/2fa/verify") {
        return { name: "auth-2fa-verify", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/2fa/save") {
        return { name: "auth-2fa-save", params: {} };
    }
    if (method === "POST" && pathname === "/api/auth/2fa/disable") {
        return { name: "auth-2fa-disable", params: {} };
    }
    if ((method === "GET" || method === "PUT") && pathname === "/api/settings") {
        return { name: "settings", params: {} };
    }
    if (method === "GET" && pathname === "/api/users") {
        return { name: "users", params: {} };
    }
    if (method === "POST" && pathname === "/api/users") {
        return { name: "create-user", params: {} };
    }
    if (method === "DELETE" && pathname === "/api/statistics") {
        return { name: "statistics", params: {} };
    }
    if (method === "GET" && pathname === "/api/docker-hosts") {
        return { name: "docker-hosts", params: {} };
    }
    if (method === "POST" && pathname === "/api/docker-hosts") {
        return { name: "save-docker-host", params: {} };
    }
    if (method === "POST" && pathname === "/api/docker-hosts/test") {
        return { name: "test-docker-host", params: {} };
    }
    if (method === "GET" && pathname === "/api/remote-browsers") {
        return { name: "remote-browsers", params: {} };
    }
    if (method === "POST" && pathname === "/api/remote-browsers") {
        return { name: "save-remote-browser", params: {} };
    }
    if (method === "POST" && pathname === "/api/remote-browsers/test") {
        return { name: "test-remote-browser", params: {} };
    }
    if (method === "GET" && pathname === "/api/proxies") {
        return { name: "proxies", params: {} };
    }
    if (method === "POST" && pathname === "/api/proxies") {
        return { name: "save-proxy", params: {} };
    }
    if (method === "GET" && pathname === "/api/notifications") {
        return { name: "notifications", params: {} };
    }
    if (method === "POST" && pathname === "/api/notifications") {
        return { name: "save-notification", params: {} };
    }
    if (method === "POST" && pathname === "/api/notifications/test") {
        return { name: "test-notification", params: {} };
    }
    if (method === "GET" && pathname === "/api/tags") {
        return { name: "tags", params: {} };
    }
    if (method === "POST" && pathname === "/api/tags") {
        return { name: "save-tag", params: {} };
    }
    if (method === "GET" && pathname === "/api/monitors") {
        return { name: "monitors", params: {} };
    }
    if (method === "GET" && pathname === "/api/dashboard/bootstrap") {
        return { name: "dashboard-bootstrap", params: {} };
    }
    if (method === "GET" && pathname === "/api/heartbeats") {
        return { name: "heartbeats", params: {} };
    }
    if (method === "POST" && pathname === "/api/heartbeats/recent") {
        return { name: "recent-heartbeats", params: {} };
    }
    if (method === "GET" && pathname === "/api/status-pages") {
        return { name: "status-pages", params: {} };
    }
    if (method === "POST" && pathname === "/api/monitors") {
        return { name: "create-monitor", params: {} };
    }
    if (method === "POST" && pathname === "/api/monitors/import") {
        return { name: "import-monitors", params: {} };
    }
    if (method === "GET" && pathname === "/api/network-profiles") {
        return { name: "network-profiles", params: {} };
    }
    if (method === "GET" && pathname === "/api/twingate/status") {
        return { name: "twingate-status", params: {} };
    }

    const userPasswordMatch = pathname.match(/^\/api\/users\/(\d+)\/password$/);
    if (method === "PATCH" && userPasswordMatch) {
        return { name: "set-user-password", params: { userId: userPasswordMatch[1] } };
    }

    const userResetTwoFAMatch = pathname.match(/^\/api\/users\/(\d+)\/reset-2fa$/);
    if (method === "POST" && userResetTwoFAMatch) {
        return { name: "reset-user-2fa", params: { userId: userResetTwoFAMatch[1] } };
    }

    const userMatch = pathname.match(/^\/api\/users\/(\d+)$/);
    if (method === "GET" && userMatch) {
        return { name: "user", params: { userId: userMatch[1] } };
    }
    if (method === "PUT" && userMatch) {
        return { name: "update-user", params: { userId: userMatch[1] } };
    }
    if (method === "DELETE" && userMatch) {
        return { name: "delete-user", params: { userId: userMatch[1] } };
    }

    const networkRouteMatch = pathname.match(/^\/api\/monitors\/(\d+)\/network-route$/);
    if (method === "PATCH" && networkRouteMatch) {
        return { name: "patch-network-route", params: { monitorId: networkRouteMatch[1] } };
    }

    const notificationMatch = pathname.match(/^\/api\/notifications\/(\d+)$/);
    if ((method === "PUT" || method === "DELETE") && notificationMatch) {
        return {
            name: method === "PUT" ? "save-notification" : "delete-notification",
            params: { notificationId: notificationMatch[1] },
        };
    }

    const tagMatch = pathname.match(/^\/api\/tags\/(\d+)$/);
    if ((method === "PUT" || method === "DELETE") && tagMatch) {
        return {
            name: method === "PUT" ? "save-tag" : "delete-tag",
            params: { tagId: tagMatch[1] },
        };
    }

    const proxyMatch = pathname.match(/^\/api\/proxies\/(\d+)$/);
    if ((method === "PUT" || method === "DELETE") && proxyMatch) {
        return {
            name: method === "PUT" ? "save-proxy" : "delete-proxy",
            params: { proxyId: proxyMatch[1] },
        };
    }

    const dockerHostMatch = pathname.match(/^\/api\/docker-hosts\/(\d+)$/);
    if ((method === "PUT" || method === "DELETE") && dockerHostMatch) {
        return {
            name: method === "PUT" ? "save-docker-host" : "delete-docker-host",
            params: { dockerHostId: dockerHostMatch[1] },
        };
    }

    const remoteBrowserMatch = pathname.match(/^\/api\/remote-browsers\/(\d+)$/);
    if ((method === "PUT" || method === "DELETE") && remoteBrowserMatch) {
        return {
            name: method === "PUT" ? "save-remote-browser" : "delete-remote-browser",
            params: { remoteBrowserId: remoteBrowserMatch[1] },
        };
    }

    const activeMatch = pathname.match(/^\/api\/monitors\/(\d+)\/active$/);
    if (method === "PATCH" && activeMatch) {
        return { name: "set-monitor-active", params: { monitorId: activeMatch[1] } };
    }

    const heartbeatsMatch = pathname.match(/^\/api\/monitors\/(\d+)\/heartbeats$/);
    if ((method === "GET" || method === "DELETE") && heartbeatsMatch) {
        return { name: "monitor-heartbeats", params: { monitorId: heartbeatsMatch[1] } };
    }

    const chartMatch = pathname.match(/^\/api\/monitors\/(\d+)\/chart$/);
    if (method === "GET" && chartMatch) {
        return { name: "monitor-chart", params: { monitorId: chartMatch[1] } };
    }

    const checkNowMatch = pathname.match(/^\/api\/monitors\/(\d+)\/check-now$/);
    if (method === "POST" && checkNowMatch) {
        return { name: "check-now", params: { monitorId: checkNowMatch[1] } };
    }

    const monitorTagsMatch = pathname.match(/^\/api\/monitors\/(\d+)\/tags$/);
    if ((method === "POST" || method === "DELETE") && monitorTagsMatch) {
        return {
            name: method === "POST" ? "add-monitor-tag" : "delete-monitor-tag",
            params: { monitorId: monitorTagsMatch[1] },
        };
    }

    const statusPageHeartbeatMatch = pathname.match(/^\/api\/status-page\/heartbeat\/([^/]+)$/);
    if (method === "GET" && statusPageHeartbeatMatch) {
        return { name: "status-page-heartbeat", params: { slug: statusPageHeartbeatMatch[1] } };
    }

    const statusPageIncidentHistoryMatch = pathname.match(/^\/api\/status-page\/([^/]+)\/incident-history$/);
    if (method === "GET" && statusPageIncidentHistoryMatch) {
        return { name: "status-page-incident-history", params: { slug: statusPageIncidentHistoryMatch[1] } };
    }

    const statusPageMatch = pathname.match(/^\/api\/status-page\/([^/]+)$/);
    if (method === "PUT" && statusPageMatch) {
        return { name: "save-status-page", params: { slug: statusPageMatch[1] } };
    }
    if (method === "GET" && statusPageMatch) {
        return { name: "status-page", params: { slug: statusPageMatch[1] } };
    }

    const monitorMatch = pathname.match(/^\/api\/monitors\/(\d+)$/);
    if (method === "GET" && monitorMatch) {
        return { name: "monitor", params: { monitorId: monitorMatch[1] } };
    }
    if (method === "PUT" && monitorMatch) {
        return { name: "update-monitor", params: { monitorId: monitorMatch[1] } };
    }
    if (method === "DELETE" && monitorMatch) {
        return { name: "delete-monitor", params: { monitorId: monitorMatch[1] } };
    }

    return { name: "not-found", params: {} };
}

function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

function formatSqliteDateTime(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseSqliteDateTime(value) {
    if (value instanceof Date) {
        return value.getTime();
    }
    const text = String(value || "");
    const parsed = Date.parse(text.includes("T") ? text : `${text.replace(" ", "T")}Z`);
    return Number.isFinite(parsed) ? parsed : Date.now();
}

async function runD1(env, label, statement) {
    const result = await statement.run();
    logD1Usage(env, label, result);
    return result;
}

async function allD1(env, label, statement) {
    const result = await statement.all();
    logD1Usage(env, label, result);
    return result;
}

function logD1Usage(env, label, result) {
    if (!isD1UsageDebugEnabled(env)) {
        return;
    }
    const results = Array.isArray(result) ? result : [result];
    const summary = results.reduce((total, entry) => {
        const meta = entry?.meta || {};
        return {
            rows_read: total.rows_read + Number(meta.rows_read || 0),
            rows_written: total.rows_written + Number(meta.rows_written || 0),
            statements: total.statements + 1,
        };
    }, { rows_read: 0, rows_written: 0, statements: 0 });
    console.log(JSON.stringify({
        type: "d1_usage",
        label,
        rows_read: summary.rows_read,
        rows_written: summary.rows_written,
        statements: summary.statements,
    }));
}

function isD1UsageDebugEnabled(env = {}) {
    const value = env.D1_USAGE_DEBUG;
    return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || ""));
}

function json(body, status = 200) {
    return Response.json(body, { status });
}

export function resolveAppVersion(env = {}) {
    return env.APP_VERSION || DEFAULT_APP_VERSION;
}
