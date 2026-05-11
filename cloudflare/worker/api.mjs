const DIRECT_PROFILE = {
    id: null,
    slug: "direct",
    name: "Direct",
    type: "direct",
    enabled: true,
};

export async function handleApiRequest(request, env) {
    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);

    try {
        if (route.name === "entry-page") {
            return json({ type: "entryPage", entryPage: "dashboard" });
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

function normalizeNetworkProfileId(value) {
    return value === undefined || value === "" || value === "direct" ? null : value;
}

function matchRoute(method, pathname) {
    if (method === "GET" && pathname === "/api/entry-page") {
        return { name: "entry-page", params: {} };
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

    const checkNowMatch = pathname.match(/^\/api\/monitors\/(\d+)\/check-now$/);
    if (method === "POST" && checkNowMatch) {
        return { name: "check-now", params: { monitorId: checkNowMatch[1] } };
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
