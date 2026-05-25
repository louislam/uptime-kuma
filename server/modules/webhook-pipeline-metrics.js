/**
 * Live webhook pipeline metrics for public status page (proxy Recv-Q + RabbitMQ queue).
 * Uses local ss + RabbitMQ management + fast /health probe (never blocks on /api/status).
 */

const { execSync } = require('child_process');
const http = require('http');
const axios = require('axios');

const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PIPELINE_PORT || '3005', 10) || 3005;
const WEBHOOK_CONFIG_JS =
    process.env.WEBHOOK_CONFIG_JS_PATH ||
    '/home/newstargeted.com/webhook.newstargeted.com/config.js';
const PUBLISHER_PROBE_TIMEOUT_MS =
    parseInt(process.env.WEBHOOK_PIPELINE_PUBLISHER_PROBE_MS || '1500', 10) || 1500;
const RABBITMQ_FETCH_TIMEOUT_MS =
    parseInt(process.env.RABBITMQ_PIPELINE_MGMT_TIMEOUT_MS || '5000', 10) || 5000;

let cache = { expiresAt: 0, value: null };
const CACHE_TTL_MS = parseInt(process.env.WEBHOOK_PIPELINE_CACHE_MS || '5000', 10) || 5000;

let rabbitConfigCache = null;

function parseSsListenLine(line) {
    const parts = String(line || '')
        .trim()
        .split(/\s+/);
    if (parts.length < 3) {
        return { recvQ: null, sendQ: null };
    }
    // ss -H -ltn: LISTEN Recv-Q Send-Q Local:Port Peer:Port
    if (parts[0] === 'LISTEN') {
        return {
            recvQ: parseInt(parts[1], 10),
            sendQ: parseInt(parts[2], 10),
        };
    }
    return {
        recvQ: parseInt(parts[0], 10),
        sendQ: parseInt(parts[1], 10),
    };
}

function loadRabbitManagementConfig() {
    if (rabbitConfigCache) {
        return rabbitConfigCache;
    }

    try {
        const { get } = require(WEBHOOK_CONFIG_JS);
        const amqpHost = String(get('rabbitmq.host', 'localhost') || 'localhost');
        const mgmtHostExplicit = String(get('rabbitmq.managementHost', '') || '').trim();
        const managementHost =
            mgmtHostExplicit ||
            (amqpHost.toLowerCase() === 'localhost' || amqpHost === '::1' ? '127.0.0.1' : amqpHost);

        rabbitConfigCache = {
            host: managementHost,
            port: parseInt(String(get('rabbitmq.management_port', 15672)), 10) || 15672,
            user: get('rabbitmq.user', 'guest'),
            password: get('rabbitmq.password', 'guest'),
            vhost: get('rabbitmq.vhost', '/'),
            queueName: get('queue.name', 'webhook-proxy'),
        };
        return rabbitConfigCache;
    } catch (error) {
        return null;
    }
}

function recvQLevel(recvQ) {
    if (recvQ == null || !Number.isFinite(recvQ)) {
        return 'unknown';
    }
    if (recvQ >= 500) {
        return 'critical';
    }
    if (recvQ >= 50) {
        return 'warning';
    }
    return 'ok';
}

function connectionPressureLevel(established) {
    if (established == null || !Number.isFinite(established)) {
        return 'unknown';
    }
    if (established >= 900) {
        return 'critical';
    }
    if (established >= 500) {
        return 'warning';
    }
    return 'ok';
}

function queueLevel(ready) {
    if (ready == null || !Number.isFinite(ready)) {
        return 'unknown';
    }
    if (ready >= 1000) {
        return 'critical';
    }
    if (ready >= 100) {
        return 'warning';
    }
    return 'ok';
}

function buildQueuePayload(queueRaw) {
    if (!queueRaw || typeof queueRaw !== 'object') {
        return {
            connected: false,
            queueName: 'webhook-proxy',
            messagesReady: null,
            messagesUnacknowledged: null,
            messageCount: null,
            consumerCount: null,
            readyLevel: 'unknown',
        };
    }

    const messagesReady = queueRaw.messagesReady ?? queueRaw.messages_ready ?? 0;
    const messagesUnacknowledged =
        queueRaw.messagesUnacknowledged ?? queueRaw.messages_unacknowledged ?? 0;
    const messageCount = queueRaw.messageCount ?? queueRaw.messages ?? 0;

    return {
        connected: queueRaw.connected !== false,
        queueName: queueRaw.queueName || 'webhook-proxy',
        messagesReady,
        messagesUnacknowledged,
        messageCount,
        consumerCount: queueRaw.consumerCount ?? queueRaw.consumers ?? 0,
        prefetchEffective: queueRaw.prefetchEffective ?? null,
        publisherChannelOpen: queueRaw.publisherChannelOpen ?? null,
        readyLevel: queueLevel(messagesReady),
        source: queueRaw.source || 'rabbitmq-management',
        error: queueRaw.error || null,
    };
}

function readLocalListenMetrics(port) {
    let recvQTotal = 0;
    let sendQMax = 0;
    let listenerCount = 0;

    try {
        const ssOut = execSync(`ss -H -ltn sport = :${port}`, {
            encoding: 'utf8',
            timeout: 3000,
            stdio: ['ignore', 'pipe', 'ignore'],
        });

        for (const line of ssOut.trim().split('\n')) {
            if (!line.trim()) {
                continue;
            }
            const parsed = parseSsListenLine(line);
            if (Number.isFinite(parsed.recvQ)) {
                recvQTotal += parsed.recvQ;
            }
            if (Number.isFinite(parsed.sendQ)) {
                sendQMax = Math.max(sendQMax, parsed.sendQ);
            }
            listenerCount += 1;
        }

        return { recvQ: recvQTotal, sendQMax, listenerCount, source: 'local-ss' };
    } catch (error) {
        return { recvQ: null, sendQMax: null, listenerCount: 0, source: 'local-ss', ssError: error.message };
    }
}

function readLocalEstablished(port) {
    try {
        const out = execSync(
            `ss -H -tn state established '( sport = :${port} )' 2>/dev/null | wc -l`,
            {
                encoding: 'utf8',
                timeout: 3000,
                stdio: ['ignore', 'pipe', 'ignore'],
            }
        );
        return parseInt(String(out).trim(), 10) || 0;
    } catch (error) {
        return null;
    }
}

function countLocalhostEstablished(port) {
    try {
        const out = execSync(
            `ss -H -tn state established '( sport = :${port} )' 2>/dev/null | awk '{print $4}' | grep -c '^127.0.0.1:' || true`,
            {
                encoding: 'utf8',
                timeout: 3000,
                stdio: ['ignore', 'pipe', 'ignore'],
            }
        );
        return parseInt(String(out).trim(), 10) || 0;
    } catch (error) {
        return null;
    }
}

async function fetchRabbitMQQueueViaManagement() {
    const cfg = loadRabbitManagementConfig();
    if (!cfg) {
        return buildQueuePayload({
            connected: false,
            source: 'rabbitmq-management-error',
            error: 'Could not load RabbitMQ config',
        });
    }

    const vhostEncoded = encodeURIComponent(cfg.vhost);
    const queueEncoded = encodeURIComponent(cfg.queueName);
    const apiUrl = `http://${cfg.host}:${cfg.port}/api/queues/${vhostEncoded}/${queueEncoded}`;

    try {
        const res = await axios.get(apiUrl, {
            timeout: RABBITMQ_FETCH_TIMEOUT_MS,
            auth: {
                username: cfg.user,
                password: cfg.password,
            },
            validateStatus: (status) => status >= 200 && status < 300,
        });

        return buildQueuePayload({
            connected: true,
            queueName: cfg.queueName,
            messagesReady: res.data.messages_ready,
            messagesUnacknowledged: res.data.messages_unacknowledged,
            messageCount: res.data.messages,
            consumerCount: res.data.consumers,
            source: 'rabbitmq-management',
        });
    } catch (error) {
        return buildQueuePayload({
            connected: false,
            queueName: cfg.queueName,
            source: 'rabbitmq-management-error',
            error: error.message,
        });
    }
}

function probePublisherHealth(port, timeoutMs = PUBLISHER_PROBE_TIMEOUT_MS) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.get(
            {
                host: '127.0.0.1',
                port,
                path: '/health',
                timeout: timeoutMs,
            },
            (res) => {
                res.resume();
                resolve({
                    publisherHealthy: res.statusCode === 200,
                    publisherProbeMs: Date.now() - start,
                    publisherProbePath: '/health',
                    publisherProbeStatus: res.statusCode,
                    timedOut: false,
                });
            }
        );

        req.on('error', () => {
            resolve({
                publisherHealthy: false,
                publisherProbeMs: Date.now() - start,
                publisherProbePath: '/health',
                timedOut: false,
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                publisherHealthy: false,
                publisherProbeMs: Date.now() - start,
                publisherProbePath: '/health',
                timedOut: true,
            });
        });
    });
}

function mergeProxyLevel(recvQLevel, connectionLevel, publisherHealthy) {
    const order = { ok: 0, unknown: 1, warning: 2, critical: 3 };
    let level = recvQLevel;
    if (order[connectionLevel] > order[level]) {
        level = connectionLevel;
    }
    if (publisherHealthy === false && level === 'ok') {
        level = 'warning';
    }
    return level;
}

async function fetchWebhookPipelineMetrics() {
    if (cache.value && Date.now() < cache.expiresAt) {
        return cache.value;
    }

    const timestamp = new Date().toISOString();
    const listen = readLocalListenMetrics(WEBHOOK_PORT);
    const establishedConnections = readLocalEstablished(WEBHOOK_PORT);

    const [queue, publisherProbe] = await Promise.all([
        fetchRabbitMQQueueViaManagement(),
        probePublisherHealth(WEBHOOK_PORT),
    ]);

    const recvQ = listen.recvQ;
    const recvQLevelValue = recvQLevel(recvQ);
    const connectionLevel = connectionPressureLevel(establishedConnections);
    const proxyLevel = mergeProxyLevel(recvQLevelValue, connectionLevel, publisherProbe.publisherHealthy);

    const warnings = [];
    if (publisherProbe.timedOut || publisherProbe.publisherHealthy === false) {
        warnings.push('Webhook service is slow to respond (high load).');
    }
    if (connectionLevel === 'critical' || connectionLevel === 'warning') {
        warnings.push('High number of active connections to the webhook service.');
    }
    if (recvQLevelValue === 'critical' || recvQLevelValue === 'warning') {
        warnings.push('Large HTTP request backlog. New requests may wait or fail.');
    }

    const proxy = {
        recvQ,
        recvQLevel: proxyLevel,
        establishedConnections,
        publisherHealthy: publisherProbe.publisherHealthy,
        healthy:
            proxyLevel !== 'critical' &&
            queue.readyLevel !== 'critical' &&
            publisherProbe.publisherHealthy !== false,
    };

    const queuePublic = {
        connected: queue.connected,
        messagesReady: queue.messagesReady,
        messagesUnacknowledged: queue.messagesUnacknowledged,
        messageCount: queue.messageCount,
        consumerCount: queue.consumerCount,
        readyLevel: queue.readyLevel,
    };
    if (!queue.connected && queue.error) {
        queuePublic.error = 'unavailable';
    }

    const payload = {
        timestamp,
        proxy,
        queue: queuePublic,
        ...(warnings.length ? { warnings } : {}),
    };

    cache = {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: payload,
    };

    return payload;
}

module.exports = {
    fetchWebhookPipelineMetrics,
    parseSsListenLine,
};
