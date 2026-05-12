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
    "childrenIDs",
    "tags",
    "notificationIDList",
    "parent",
    "getUrl",
]);

const MISSING_CONFIG_JSON_COLUMN = /no such column:\s*config_json/i;
const MISSING_PARENT_COLUMN = /(?:no such column:\s*parent|no column named parent)/i;
const ACCESS_CERT_CACHE_TTL_MS = 60 * 60 * 1000;
const accessCertCache = new Map();
const ADMIN_ROUTE_NAMES = new Set([
    "monitors",
    "settings",
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
]);
const PRIVATE_WORKER_HOST_ERROR =
    "Direct Worker checks cannot target private, loopback, link-local, or metadata hosts";

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
 * @returns {Promise<object>} Import summary with one result per source monitor.
 */
export async function importMonitors(env, importInput = {}) {
    const monitors = extractImportMonitors(importInput);
    const importHandle = normalizeImportHandle(importInput.importHandle || importInput.mode);
    const existingRows = await listMonitorRows(env);
    const existingByName = new Map(existingRows.map((monitor) => [monitor.name, monitor]));
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

        const existing = existingByName.get(name);
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
                existingByName.delete(name);
                overwritten++;
            }

            const normalizedMonitor = normalizeImportedMonitor(sourceMonitor);
            const sourceParent = normalizeImportParentId(sourceMonitor.parent);
            if (sourceParent != null) {
                normalizedMonitor.parent = importedIdBySourceId.get(sourceParent) || null;
            }
            const monitorID = await createMonitor(env, normalizedMonitor);
            rememberImportedSourceId(importedIdBySourceId, sourceMonitor, monitorID);
            if (sourceParent != null && !normalizedMonitor.parent) {
                pendingParents.push({ monitorID, sourceParent });
            }
            const importedMonitor = {
                ...result,
                status: "imported",
                monitorID,
            };
            imported++;
            existingByName.set(name, { id: monitorID, name });
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
        heartbeats: (result.results || []).map(serializeHeartbeat),
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

    if (await isCloudflareAccessAdminRequest(request, env)) {
        return;
    }

    if (!expectedToken || typeof expectedToken !== "string") {
        throw httpError(503, "Admin API token is not configured");
    }

    throw httpError(401, "Unauthorized");
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
    if (Array.isArray(tokenAudience)) {
        return tokenAudience.includes(expectedAudience);
    }
    return tokenAudience === expectedAudience;
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

function sanitizeRunnerStatus(status = {}) {
    return {
        configured: Boolean(status.configured),
        starting: Boolean(status.starting),
        running: Boolean(status.running),
        proxyUrl: status.proxyUrl || null,
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
 * @returns {object} Monitor payload accepted by createMonitor.
 */
function normalizeImportedMonitor(source) {
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
    for (const field of BOOLEAN_IMPORT_FIELDS) {
        if (field in monitor) {
            monitor[field] = normalizeBoolean(monitor[field]);
        }
    }
    return monitor;
}

/**
 * Track old-to-new ID mappings when source monitor IDs are present.
 * @param {Map<number, number>} importedIdBySourceId Source ID map.
 * @param {object} source Source monitor.
 * @param {number} monitorID New or existing monitor ID.
 * @returns {void}
 */
function rememberImportedSourceId(importedIdBySourceId, source, monitorID) {
    const sourceId = normalizeImportParentId(source.id);
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
        lastHeartbeat: latestHeartbeat ? serializeHeartbeat(latestHeartbeat) : null,
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

function serializeHeartbeat(heartbeat) {
    return {
        monitorID: Number(heartbeat.monitor_id ?? heartbeat.monitorID),
        status: heartbeat.status,
        ping: heartbeat.ping,
        msg: heartbeat.msg,
        time: heartbeat.checked_at ?? heartbeat.time,
    };
}

function normalizeNetworkProfileId(value) {
    return value === undefined || value === "" || value === "direct" ? null : value;
}

function matchRoute(method, pathname) {
    if (method === "GET" && pathname === "/api/entry-page") {
        return { name: "entry-page", params: {} };
    }
    if ((method === "GET" || method === "PUT") && pathname === "/api/settings") {
        return { name: "settings", params: {} };
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
