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
    "http",
    "keyword",
    "json-query",
    "port",
    "websocket-upgrade",
]);

export async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);

    try {
        if (route.name === "entry-page") {
            return json({ type: "entryPage", entryPage: "dashboard" });
        }

        if (route.name === "monitors") {
            return json({ monitors: await listMonitors(env) });
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
    const monitorResult = await env.DB.prepare(
        `SELECT id, name, type, url, hostname, port, method, headers, body, keyword,
                invert_keyword, json_path, expected_value, timeout, "interval",
                active, network_profile_id
         FROM monitors
         ORDER BY name`
    ).all();
    const monitors = monitorResult.results || [];

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
        return serializeMonitor(monitor, latestHeartbeat);
    });
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
    return serializeMonitor(monitor, heartbeat);
}

export async function createMonitor(env, monitorInput) {
    const monitor = normalizeMonitorInput(monitorInput);
    const result = await env.DB.prepare(
        `INSERT INTO monitors (
            name, type, url, hostname, port, method, headers, body, keyword,
            invert_keyword, json_path, expected_value, timeout, "interval",
            active, network_profile_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
        .bind(...monitorValues(monitor, true))
        .run();
    return Number(result.meta?.last_row_id || result.meta?.last_rowid || result.lastRowId || result.last_row_id);
}

export async function updateMonitor(env, monitorId, monitorInput) {
    const existing = await getMonitor(env, monitorId);
    if (!existing) {
        throw httpError(404, "Monitor not found");
    }
    const monitor = normalizeMonitorInput(monitorInput, existing);
    await env.DB.prepare(
        `UPDATE monitors SET
            name = ?, type = ?, url = ?, hostname = ?, port = ?, method = ?,
            headers = ?, body = ?, keyword = ?, invert_keyword = ?,
            json_path = ?, expected_value = ?, timeout = ?, "interval" = ?,
            network_profile_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
    )
        .bind(...monitorValues(monitor, false), monitorId)
        .run();
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
        "SELECT id FROM monitors WHERE active = 1 ORDER BY id"
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
    return await response.json();
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

async function getNetworkProfile(env, networkProfileId) {
    return await env.DB.prepare("SELECT id, slug, name, type, enabled FROM network_profiles WHERE id = ?")
        .bind(networkProfileId)
        .first();
}

function sanitizeMonitor(monitor) {
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
    };
}

function monitorValues(monitor, includeActive) {
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
    return values;
}

function serializeMonitor(monitor, latestHeartbeat = null) {
    const name = monitor.name || "";
    return {
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
        parent: null,
        path: [name],
        childrenIDs: [],
        tags: [],
        notificationIDList: {},
        networkProfileId: monitor.network_profile_id ?? monitor.networkProfileId ?? null,
        lastHeartbeat: latestHeartbeat ? serializeHeartbeat(latestHeartbeat) : null,
    };
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
    if (method === "POST" && pathname === "/api/monitors") {
        return { name: "create-monitor", params: {} };
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
