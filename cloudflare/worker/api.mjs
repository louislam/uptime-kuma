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
};
const WORKER_AUTH_USER_SETTING = "workerAuthUser";
const WORKER_AUTH_SESSION_SECRET_SETTING = "workerAuthSessionSecret";
const SENSITIVE_SETTING_KEYS = new Set([
    WORKER_AUTH_USER_SETTING,
    WORKER_AUTH_SESSION_SECRET_SETTING,
]);
const WORKER_AUTH_PASSWORD_ITERATIONS = 210000;
const WORKER_AUTH_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const WORKER_AUTH_REMEMBER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

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
    "parent",
    "parentName",
    "parent_name",
    "groupName",
    "group_name",
    "getUrl",
    "__derivedGroupPath",
]);

const MISSING_CONFIG_JSON_COLUMN = /no such column:\s*config_json/i;
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
const ACCESS_CERT_CACHE_TTL_MS = 60 * 60 * 1000;
const accessCertCache = new Map();
const ADMIN_ROUTE_NAMES = new Set([
    "monitors",
    "settings",
    "notifications",
    "save-notification",
    "delete-notification",
    "test-notification",
    "create-monitor",
    "import-monitors",
    "monitor",
    "update-monitor",
    "set-monitor-active",
    "delete-monitor",
    "monitor-heartbeats",
    "network-profiles",
    "patch-network-route",
    "check-now",
    "twingate-status",
    "auth-local-user",
]);
const PRIVATE_WORKER_HOST_ERROR =
    "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts";
const DUPLICATE_COLUMN_ERROR = /duplicate column name:\s*parent/i;

export async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);

    try {
        if (ADMIN_ROUTE_NAMES.has(route.name)) {
            await requireAdminRequest(request, env);
        }

        if (route.name === "entry-page") {
            return json({ type: "entryPage", entryPage: "dashboard" });
        }

        if (route.name === "auth-session") {
            return json(await getWorkerAuthSession(request, env));
        }

        if (route.name === "auth-login") {
            return json(await loginWorkerAuthUser(env, await request.json()));
        }

        if (route.name === "auth-logout") {
            return json({ ok: true });
        }

        if (route.name === "auth-local-user") {
            return json(await saveWorkerAuthUser(env, await request.json()));
        }

        if (route.name === "monitors") {
            return json({ monitors: await listMonitors(env) });
        }

        if (route.name === "status-pages") {
            return json({ statusPages: await listStatusPages() });
        }

        if (route.name === "status-page") {
            return json(await getStatusPageData(env, route.params.slug));
        }

        if (route.name === "status-page-heartbeat") {
            return json(await getStatusPageHeartbeatData(env, route.params.slug));
        }

        if (route.name === "status-page-incident-history") {
            assertDefaultStatusPageSlug(route.params.slug);
            return json({ ok: true, incidents: [], nextCursor: null, hasMore: false });
        }

        if (route.name === "settings") {
            if (request.method === "GET") {
                return json({ data: await getUiSettings(env) });
            }
            await setUiSettings(env, await request.json());
            return json({ ok: true, msg: "Settings saved" });
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
            return json(
                { ok: false, msg: "Testing notifications is not available in the Cloudflare Worker UI yet." },
                501
            );
        }

        if (route.name === "create-monitor") {
            const monitorID = await createMonitor(env, await request.json());
            return json({ ok: true, msg: "Monitor saved", monitorID });
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
            await updateMonitor(env, Number(route.params.monitorId), await request.json());
            return json({ ok: true, msg: "Monitor saved" });
        }

        if (route.name === "set-monitor-active") {
            const body = await request.json();
            const active = Boolean(body.active);
            await setMonitorActive(env, Number(route.params.monitorId), active);
            return json({ ok: true, active });
        }

        if (route.name === "delete-monitor") {
            await deleteMonitor(env, Number(route.params.monitorId));
            return json({ ok: true, msg: "Deleted" });
        }

        if (route.name === "monitor-heartbeats") {
            if (request.method === "GET") {
                const offset = Number(url.searchParams.get("offset") || 0);
                const count = Number(url.searchParams.get("count") || 100);
                return json(await listMonitorHeartbeats(env, Number(route.params.monitorId), offset, count));
            }
            await clearMonitorHeartbeats(env, Number(route.params.monitorId));
            return json({ ok: true, msg: "Heartbeats cleared" });
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
    await Promise.all(
        Object.entries(merged).map(([key, value]) =>
            env.DB.prepare(
                `INSERT INTO app_settings (key, value, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP`
            )
                .bind(key, JSON.stringify(value))
                .run()
        )
    );
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
 * List monitors and their latest heartbeat for the Worker-hosted web UI.
 * @param {object} env Cloudflare Worker environment bindings.
 * @returns {Promise<object[]>} Monitor rows shaped for the Vue dashboard.
 */
export async function listMonitors(env) {
    const monitors = await listMonitorRows(env);
    const relationshipData = buildMonitorRelationshipData(monitors);

    const heartbeatResult = await env.DB.prepare(
        `SELECT h.monitor_id, h.status, h.ping, h.msg, h.checked_at
         FROM heartbeats h
         INNER JOIN (
             SELECT monitor_id, MAX(checked_at) AS checked_at
             FROM heartbeats
             GROUP BY monitor_id
         ) latest
             ON latest.monitor_id = h.monitor_id
             AND latest.checked_at = h.checked_at`
    ).all();
    const heartbeatsByMonitorId = new Map(
        (heartbeatResult.results || []).map((heartbeat) => [Number(heartbeat.monitor_id), heartbeat])
    );

    return monitors.map((monitor) => {
        const latestHeartbeat = heartbeatsByMonitorId.get(Number(monitor.id));
        return serializeMonitor(monitor, latestHeartbeat, relationshipData);
    });
}

async function listMonitorRows(env) {
    try {
        const monitorResult = await env.DB.prepare(
            `SELECT id, name, type, url, hostname, port, method, headers, body, keyword,
                    invert_keyword, json_path, expected_value, timeout, "interval",
                    active, network_profile_id, parent, config_json
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

export async function listStatusPages() {
    return {
        1: workerStatusPageConfig(),
    };
}

export async function getStatusPageData(env, slug) {
    assertDefaultStatusPageSlug(slug);
    const monitors = await listMonitors(env);
    return {
        config: workerStatusPageConfig(),
        incidents: [],
        publicGroupList: [
            {
                id: 1,
                name: "Services",
                weight: 1,
                monitorList: monitors.map(toPublicStatusPageMonitor),
            },
        ],
        maintenanceList: [],
    };
}

export async function getStatusPageHeartbeatData(env, slug) {
    assertDefaultStatusPageSlug(slug);
    const monitors = await listMonitors(env);
    const heartbeatList = {};
    const uptimeList = {};

    await Promise.all(
        monitors.map(async (monitor) => {
            const result = await listMonitorHeartbeats(env, monitor.id, 0, 100);
            const heartbeats = result.heartbeats.slice().reverse();
            heartbeatList[monitor.id] = heartbeats;
            uptimeList[`${monitor.id}_24`] = calculateStatusPageUptime(heartbeats);
        })
    );

    return {
        heartbeatList,
        uptimeList,
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
    return serializeMonitor(monitor, heartbeat, buildMonitorRelationshipData(rows));
}

export async function createMonitor(env, monitorInput) {
    const monitor = normalizeMonitorInput(monitorInput);
    let result;
    try {
        result = await env.DB.prepare(
            `INSERT INTO monitors (
                name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id, parent, config_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(...monitorValues(monitor, true), monitorConfigJson(monitorInput, {}, monitor))
            .run();
    } catch (error) {
        if (!MISSING_PARENT_COLUMN.test(error.message || "") || monitor.parent != null) {
            throw error;
        }
        result = await env.DB.prepare(
            `INSERT INTO monitors (
                name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id, config_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
            .bind(...monitorValues(monitor, true, false), monitorConfigJson(monitorInput, {}, monitor))
            .run();
    }
    return Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
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
                network_profile_id = ?, parent = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(...monitorValues(monitor, false), monitorConfigJson(monitorInput, existing, monitor), monitorId)
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
                network_profile_id = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`
        )
            .bind(...monitorValues(monitor, false, false), monitorConfigJson(monitorInput, existing, monitor), monitorId)
            .run();
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
    const monitor = await getMonitor(env, monitorId);
    if (!monitor) {
        throw httpError(404, "Monitor not found");
    }
    await clearMonitorHeartbeats(env, monitorId);
    await updateDeletedMonitorChildren(env, monitorId);
    await env.DB.prepare("DELETE FROM monitors WHERE id = ?")
        .bind(monitorId)
        .run();
}

export async function listMonitorHeartbeats(env, monitorId, offset = 0, count = 100) {
    const monitor = await getMonitor(env, monitorId);
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

export async function clearMonitorHeartbeats(env, monitorId) {
    await env.DB.prepare("DELETE FROM heartbeats WHERE monitor_id = ?")
        .bind(monitorId)
        .run();
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
    if (monitor.type === "group") {
        throw httpError(400, "Group monitors do not run checks");
    }

    const networkProfile = monitor.network_profile_id ? await getNetworkProfile(env, monitor.network_profile_id) : null;
    const job = {
        monitor: sanitizeMonitor(monitor),
        networkProfile,
    };
    const result = await callRunner(env, job);
    await writeHeartbeat(env, monitorId, result);
    return result;
}

export async function enqueueDueMonitors(env) {
    const result = await env.DB.prepare(
        "SELECT id FROM monitors WHERE active = 1 AND type != 'group' ORDER BY id"
    ).all();

    await Promise.all(
        (result.results || []).map((monitor) =>
            env.MONITOR_QUEUE.send({
                monitorId: monitor.id,
                queuedAt: new Date().toISOString(),
            })
        )
    );
}

export async function consumeQueue(batch, env) {
    for (const message of batch.messages || []) {
        await executeMonitorCheck(env, Number(message.body.monitorId));
        message.ack?.();
    }
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
        throw httpError(502, `Runner check failed with ${response.status}`);
    }
    return await response.json();
}

async function fetchRunnerStatus(env) {
    const stub = getRunnerStub(env);
    const response = await stub.fetch(new Request("http://runner/twingate/status"));
    if (!response.ok) {
        throw httpError(502, `Runner status failed with ${response.status}`);
    }
    return sanitizeRunnerStatus(await response.json());
}

function getRunnerStub(env) {
    if (typeof env.RUNNER.getByName === "function") {
        return env.RUNNER.getByName("default");
    }
    if (typeof env.RUNNER.get === "function" && typeof env.RUNNER.idFromName === "function") {
        return env.RUNNER.get(env.RUNNER.idFromName("default"));
    }
    return env.RUNNER.get("default");
}

async function writeHeartbeat(env, monitorId, result) {
    let responseR2Key = null;
    if (result.response && env.ARTIFACTS) {
        responseR2Key = `responses/${monitorId}/${Date.now()}.txt`;
        await env.ARTIFACTS.put(responseR2Key, result.response);
    }

    await env.DB.prepare(
        "INSERT INTO heartbeats (monitor_id, status, ping, msg, response_r2_key) VALUES (?, ?, ?, ?, ?)"
    )
        .bind(monitorId, result.status, result.ping ?? null, result.msg ?? "", responseR2Key)
        .run();
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
    return {
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
        packetSize: config.packetSize,
        ping_count: config.ping_count,
        ping_numeric: config.ping_numeric,
        ping_per_request_timeout: config.ping_per_request_timeout,
    };
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
    const networkProfileId = normalizeNetworkProfileId(monitor.networkProfileId ?? monitor.network_profile_id);
    const parent = normalizeMonitorParent(monitor.parent ?? existing.parent);
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
    };
}

async function requireAdminRequest(request, env) {
    const expectedToken = env.ADMIN_API_TOKEN;
    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (expectedToken && typeof expectedToken === "string" && timingSafeEqual(suppliedToken, expectedToken)) {
        return;
    }

    const localAuthUser = await getWorkerAuthUser(env);
    if (localAuthUser && await verifyWorkerAuthSessionToken(suppliedToken, env)) {
        return;
    }

    if (!localAuthUser && await isCloudflareAccessAdminRequest(request, env)) {
        return;
    }

    if (localAuthUser) {
        throw httpError(401, "Unauthorized");
    }

    if (!expectedToken || typeof expectedToken !== "string") {
        throw httpError(503, "Admin API token is not configured");
    }

    throw httpError(401, "Unauthorized");
}

async function getWorkerAuthSession(request, env) {
    const localAuthUser = await getWorkerAuthUser(env);
    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const session = localAuthUser ? await verifyWorkerAuthSessionToken(suppliedToken, env) : null;
    if (session) {
        return {
            authenticated: true,
            username: session.username,
            localAuthConfigured: true,
        };
    }

    if (!localAuthUser && await isBootstrapAdminRequest(request, env)) {
        return {
            authenticated: true,
            username: "Cloudflare",
            localAuthConfigured: false,
        };
    }

    return {
        authenticated: false,
        username: null,
        localAuthConfigured: Boolean(localAuthUser),
    };
}

async function isBootstrapAdminRequest(request, env) {
    const expectedToken = env.ADMIN_API_TOKEN;
    const authorization = request.headers.get("authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (expectedToken && typeof expectedToken === "string" && timingSafeEqual(suppliedToken, expectedToken)) {
        return true;
    }
    return await isCloudflareAccessAdminRequest(request, env);
}

async function saveWorkerAuthUser(env, body) {
    const username = String(body?.username || "").trim();
    const newPassword = String(body?.newPassword || body?.password || "");
    if (!username) {
        throw httpError(400, "Username is required");
    }
    if (newPassword.length < 6) {
        throw httpError(400, "passwordTooWeak");
    }
    const authUser = {
        username,
        password: await hashWorkerAuthPassword(newPassword),
        updatedAt: new Date().toISOString(),
    };
    await setStoredSetting(env, WORKER_AUTH_USER_SETTING, authUser);
    await ensureWorkerAuthSessionSecret(env);
    return {
        ok: true,
        msg: "Local admin login saved",
        token: await createWorkerAuthSessionToken(env, username, WORKER_AUTH_SESSION_TTL_SECONDS),
        username,
        localAuthConfigured: true,
    };
}

async function loginWorkerAuthUser(env, body) {
    const username = String(body?.username || "").trim();
    const password = String(body?.password || "");
    const authUser = await getWorkerAuthUser(env);
    if (!authUser || authUser.username !== username || !await verifyWorkerAuthPassword(password, authUser.password)) {
        throw httpError(401, "authIncorrectCreds");
    }

    const ttlSeconds = body?.remember ? WORKER_AUTH_REMEMBER_SESSION_TTL_SECONDS : WORKER_AUTH_SESSION_TTL_SECONDS;
    const token = await createWorkerAuthSessionToken(env, authUser.username, ttlSeconds);
    return {
        ok: true,
        token,
        username: authUser.username,
        localAuthConfigured: true,
    };
}

async function getWorkerAuthUser(env) {
    const authUser = await getStoredSetting(env, WORKER_AUTH_USER_SETTING);
    if (!authUser || typeof authUser.username !== "string" || !authUser.password) {
        return null;
    }
    return authUser;
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
    if (!Number.isFinite(iterations) || iterations < 1) {
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

async function createWorkerAuthSessionToken(env, username, ttlSeconds) {
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({
        typ: "worker-session",
        username,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    })));
    const signature = await signWorkerAuthSession(`${header}.${payload}`, await ensureWorkerAuthSessionSecret(env));
    return `${header}.${payload}.${signature}`;
}

async function verifyWorkerAuthSessionToken(token, env) {
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
        const authUser = await getWorkerAuthUser(env);
        if (!authUser || authUser.username !== payload.username) {
            return null;
        }
        return payload;
    } catch (_) {
        return null;
    }
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

    const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
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

function sanitizeRunnerStatus(status = {}) {
    return {
        configured: Boolean(status.configured),
        starting: Boolean(status.starting),
        running: Boolean(status.running),
        proxyUrl: status.proxyUrl || null,
        tunMode: status.tunMode || null,
        lastError: status.lastError || null,
    };
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
    return isPrivateNetworkHost(host);
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

function assertDefaultStatusPageSlug(slug) {
    if (!["default", "status-page", ""].includes(slug || "default")) {
        throw httpError(404, "Status Page Not Found");
    }
}

function toPublicStatusPageMonitor(monitor) {
    return {
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        url: monitor.url,
        active: monitor.active,
        tags: [],
        sendUrl: Boolean(monitor.url),
    };
}

function calculateStatusPageUptime(heartbeats) {
    if (!heartbeats.length) {
        return 0;
    }
    const up = heartbeats.filter((heartbeat) => heartbeat.status === 1).length;
    return up / heartbeats.length;
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

function serializeMonitor(monitor, latestHeartbeat = null, relationshipData = buildMonitorRelationshipData([monitor])) {
    const name = monitor.name || "";
    const config = {
        ...monitorConfigDefaults(monitor.type),
        ...parseMonitorConfig(monitor.config_json),
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
        tags: [],
        notificationIDList: {},
        networkProfileId: monitor.network_profile_id ?? monitor.networkProfileId ?? null,
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
        status: effectiveHeartbeatStatus(heartbeat.status, monitor),
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

function matchRoute(method, pathname) {
    if (method === "GET" && pathname === "/api/entry-page") {
        return { name: "entry-page", params: {} };
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
    if ((method === "GET" || method === "PUT") && pathname === "/api/settings") {
        return { name: "settings", params: {} };
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
    if (method === "GET" && pathname === "/api/monitors") {
        return { name: "monitors", params: {} };
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

    const activeMatch = pathname.match(/^\/api\/monitors\/(\d+)\/active$/);
    if (method === "PATCH" && activeMatch) {
        return { name: "set-monitor-active", params: { monitorId: activeMatch[1] } };
    }

    const heartbeatsMatch = pathname.match(/^\/api\/monitors\/(\d+)\/heartbeats$/);
    if ((method === "GET" || method === "DELETE") && heartbeatsMatch) {
        return { name: "monitor-heartbeats", params: { monitorId: heartbeatsMatch[1] } };
    }

    const checkNowMatch = pathname.match(/^\/api\/monitors\/(\d+)\/check-now$/);
    if (method === "POST" && checkNowMatch) {
        return { name: "check-now", params: { monitorId: checkNowMatch[1] } };
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

function json(body, status = 200) {
    return Response.json(body, { status });
}
