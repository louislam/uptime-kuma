const { MonitorType } = require("./monitor-type");
const { Globalping, IpVersion } = require("globalping");
const { Settings } = require("../settings");
const { log, UP, DOWN, evaluateJsonQuery } = require("../../src/util");
const { checkStatusCode, getOidcTokenClientCredentials, encodeBase64, getDaysRemaining, checkCertExpiryNotifications } = require("../util-server");
const { ConditionVariable } = require("../monitor-conditions/variables");
const { defaultStringOperators } = require("../monitor-conditions/operators");
const { ConditionExpressionGroup } = require("../monitor-conditions/expression");
const { evaluateExpressionGroup } = require("../monitor-conditions/evaluator");
const { R } = require("redbean-node");

class GlobalpingMonitorType extends MonitorType {
    name = "globalping";

    agent = "";
    hasAPIToken = false;
    creditsHelpLink = "https://dash.globalping.io?view=add-credits";

    supportsConditions = true;
    conditionVariables = [
        new ConditionVariable("record", defaultStringOperators ),
    ];

    /**
     * @inheritdoc
     */
    constructor(agent) {
        super();
        this.agent = agent;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const apiKey = await Settings.get("globalpingApiToken");
        this.hasAPIToken = !!apiKey;
        const client = new Globalping({
            auth: apiKey,
            agent: this.agent,
        });

        switch (monitor.subtype ) {
            case "ping":
                await this.ping(client, monitor, heartbeat);
                break;
            case "http":
                await this.http(client, monitor, heartbeat);
                break;
            case "dns":
                await this.dns(client, monitor, heartbeat);
                break;
        }
    }

    /**
     * @inheritdoc
     */
    async ping(client, monitor, heartbeat) {
        const opts = {
            type: "ping",
            target: monitor.hostname,
            inProgressUpdates: false,
            limit: 1,
            locations: [{ magic: monitor.location }],
            measurementOptions: {
                packets: monitor.ping_count,
                protocol: monitor.protocol,
            },
        };

        if (monitor.protocol === "TCP" && monitor.port) {
            opts.measurementOptions.port = monitor.port;
        }

        if (monitor.ipFamily === "ipv4") {
            opts.measurementOptions.ipVersion = IpVersion[4];
        } else if (monitor.ipFamily === "ipv6") {
            opts.measurementOptions.ipVersion = IpVersion[6];
        }

        log.debug("monitor", `Globalping create measurement: ${JSON.stringify(opts)}`);
        let res = await client.createMeasurement(opts);

        if (!res.ok) {
            // retry
            res = await client.createMeasurement(opts);
            if (!res.ok) {
                if (Globalping.isHttpStatus(429, res)) {
                    throw new Error(`Failed to create measurement: ${this.formatTooManyRequestsError()}`);
                }
                throw new Error(
                    `Failed to create measurement: ${this.formatApiError(res.data.error)}`
                );
            }
        }

        log.debug("monitor", `Globalping fetch measurement: ${res.data.id}`);
        let measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            // retry
            measurement = await client.awaitMeasurement(res.data.id);
            if (!measurement.ok) {
                throw new Error(
                    `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`
                );
            }
        }

        const probe = measurement.data.results[0].probe;
        const result = measurement.data.results[0].result;

        if (result.status === "failed") {
            heartbeat.msg = this.formatResponse(probe, `Failed: ${result.rawOutput}`);
            heartbeat.status = DOWN;
            return;
        }

        if (!result.timings?.length) {
            heartbeat.msg = this.formatResponse(probe, `Failed: ${result.rawOutput}`);
            heartbeat.status = DOWN;
            return;
        }

        heartbeat.ping = result.stats.avg || 0;
        heartbeat.msg = this.formatResponse(probe, "OK");
        heartbeat.status = UP;
    }

    /**
     * @inheritdoc
     */
    async http(client, monitor, heartbeat) {
        const url = new URL(monitor.url);

        let protocol = url.protocol.replace(":", "").toUpperCase();
        if (monitor.protocol === "HTTP2") {
            protocol = "HTTP2";
        }

        const basicAuthHeader = this.getBasicAuthHeader(monitor);
        const oauth2AuthHeader = await this.getOauth2AuthHeader(monitor);
        const headers = {
            ...(basicAuthHeader),
            ...(oauth2AuthHeader),
            ...(monitor.headers ? JSON.parse(monitor.headers) : {})
        };

        if (monitor.cacheBust) {
            const randomFloatString = Math.random().toString(36);
            const cacheBust = randomFloatString.substring(2);
            url.searchParams.set("uptime_kuma_cachebuster", cacheBust);
        }

        const opts = {
            type: "http",
            target: url.hostname,
            inProgressUpdates: false,
            limit: 1,
            locations: [{ magic: monitor.location }],
            measurementOptions: {
                request: {
                    host: url.hostname,
                    path: url.pathname,
                    query: url.search ? url.search.slice(1) : undefined,
                    headers
                },
                protocol: protocol,
            },
        };

        if (url.port) {
            opts.measurementOptions.port = parseInt(url.port);
        }

        if (monitor.ipFamily === "ipv4") {
            opts.measurementOptions.ipVersion = IpVersion[4];
        } else if (monitor.ipFamily === "ipv6") {
            opts.measurementOptions.ipVersion = IpVersion[6];
        }

        if (monitor.dns_resolve_server) {
            opts.measurementOptions.resolver = monitor.dns_resolve_server;
        }

        log.debug("monitor", `Globalping create measurement: ${JSON.stringify(opts)}`);
        let res = await client.createMeasurement(opts);

        if (!res.ok) {
            // retry
            res = await client.createMeasurement(opts);
            if (!res.ok) {
                if (Globalping.isHttpStatus(429, res)) {
                    throw new Error(`Failed to create measurement: ${this.formatTooManyRequestsError()}`);
                }
                throw new Error(
                    `Failed to create measurement: ${this.formatApiError(res.data.error)}`
                );
            }
        }

        log.debug("monitor", `Globalping fetch measurement: ${res.data.id}`);
        let measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            // retry
            measurement = await client.awaitMeasurement(res.data.id);
            if (!measurement.ok) {
                throw new Error(
                    `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`
                );
            }
        }

        const probe = measurement.data.results[0].probe;
        const result = measurement.data.results[0].result;

        if (result.status === "failed") {
            heartbeat.msg = this.formatResponse(probe, `Failed: ${result.rawOutput}`);
            heartbeat.status = DOWN;
            return;
        }

        heartbeat.ping = result.timings.total || 0;

        if (!checkStatusCode(result.statusCode, JSON.parse(monitor.accepted_statuscodes_json))) {
            heartbeat.msg = this.formatResponse(probe, `Status code ${result.statusCode} not accepted. Output: ${result.rawOutput}`);
            heartbeat.status = DOWN;
            return;
        }

        heartbeat.msg = this.formatResponse(probe, `${result.statusCode} - ${result.statusCodeName}`);

        // keyword
        if (monitor.keyword) {
            let data = result.rawOutput;
            let keywordFound = data.includes(monitor.keyword);

            if (keywordFound !== !Boolean(monitor.invertKeyword)) {
                data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
                if (data.length > 50) {
                    data = data.substring(0, 47) + "...";
                }
                throw new Error(heartbeat.msg + ", but keyword is " +
                    (keywordFound ? "present" : "not") + " in [" + data + "]");

            }

            heartbeat.msg += this.formatResponse(probe, ", keyword " + (keywordFound ? "is" : "not") + " found");
            heartbeat.status = UP;
            return;
        }

        // json-query
        if (monitor.expectedValue) {
            const { status, response } = await evaluateJsonQuery(result.rawOutput, monitor.jsonPath, monitor.jsonPathOperator, monitor.expectedValue);

            if (!status) {
                throw new Error(this.formatResponse(probe, `JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`));
            }

            heartbeat.msg = this.formatResponse(probe, `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`);
            heartbeat.status = UP;
            return;
        }

        await this.handleTLSInfo(monitor, protocol, result.tls);

        heartbeat.msg = this.formatResponse(probe, "OK");
        heartbeat.status = UP;
    }

    /**
     * @inheritdoc
     */
    async dns(client, monitor, heartbeat) {
        const opts = {
            type: "dns",
            target: monitor.hostname,
            inProgressUpdates: false,
            limit: 1,
            locations: [{ magic: monitor.location }],
            measurementOptions: {
                query: {
                    type: monitor.dns_resolve_type
                },
                port: monitor.port,
                protocol: monitor.protocol,
            },
        };

        if (monitor.ipFamily === "ipv4") {
            opts.measurementOptions.ipVersion = IpVersion[4];
        } else if (monitor.ipFamily === "ipv6") {
            opts.measurementOptions.ipVersion = IpVersion[6];
        }

        if (monitor.dns_resolve_server) {
            opts.measurementOptions.resolver = monitor.dns_resolve_server;
        }

        log.debug("monitor", `Globalping create measurement: ${JSON.stringify(opts)}`);
        let res = await client.createMeasurement(opts);
        log.debug("monitor", `Globalping ${JSON.stringify(res)}`);
        if (!res.ok) {
            // retry
            res = await client.createMeasurement(opts);
            if (!res.ok) {
                if (Globalping.isHttpStatus(429, res)) {
                    throw new Error(`Failed to create measurement: ${this.formatTooManyRequestsError()}`);
                }
                throw new Error(
                    `Failed to create measurement: ${this.formatApiError(res.data.error)}`
                );
            }
        }

        log.debug("monitor", `Globalping fetch measurement: ${res.data.id}`);
        let measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            // retry
            measurement = await client.awaitMeasurement(res.data.id);
            if (!measurement.ok) {
                throw new Error(
                    `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`
                );
            }
        }

        const probe = measurement.data.results[0].probe;
        const result = measurement.data.results[0].result;

        if (result.status === "failed") {
            heartbeat.msg = this.formatResponse(probe, `Failed: ${result.rawOutput}`);
            heartbeat.status = DOWN;
            return;
        }

        const conditions = ConditionExpressionGroup.fromMonitor(monitor);
        let conditionsResult = true;
        const handleConditions = (data) => conditions ? evaluateExpressionGroup(conditions, data) : true;

        const dnsMessage = (result.answers || []).map(answer => answer.value).join(" | ");
        const values = (result.answers || []).map(answer => answer.value);

        switch (monitor.dns_resolve_type) {
            case "A":
            case "AAAA":
            case "ANY":
            case "CNAME":
            case "DNSKEY":
            case "DS":
            case "HTTPS":
            case "MX":
            case "NS":
            case "NSEC":
            case "PTR":
            case "RRSIG":
            case "SOA":
            case "SRV":
            case "SVCB":
            case "TXT":
                conditionsResult = values.some(record => handleConditions({ record }));
                break;
        }

        if (monitor.dns_last_result !== dnsMessage && dnsMessage !== undefined) {
            await R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [ dnsMessage, monitor.id ]);
        }

        heartbeat.ping = result.timings.total || 0;
        if (!dnsMessage) {
            this.dnsMessage = "no records found";
        }
        heartbeat.msg = this.formatResponse(probe, dnsMessage);
        heartbeat.status = conditionsResult ? UP : DOWN;
    }

    /**
     * @inheritdoc
     */
    formatApiError(error) {
        let str = `${error.type} ${error.message}.`;
        if (error.params) {
            for (const key in error.params) {
                str += `\n${key}: ${error.params[key]}`;
            }
        }
        return str;
    }

    /**
     * @inheritdoc
     */
    formatTooManyRequestsError() {
        if (this.hasAPIToken) {
            return `You have run out of credits. Get higher limits by sponsoring us or hosting probes. Learn more at ${this.creditsHelpLink}.`;
        }
        return `You have run out of credits. Get higher limits by creating an account. Sign up at ${this.creditsHelpLink}.`;
    }

    /**
     * @inheritdoc
     */
    formatProbeLocation(probe) {
        let tag = "";

        for (const t of probe.tags) {
            if (Number.isInteger(Number(t.slice(-1)))) {
                tag = t;
                break;
            }
        }
        return `${probe.city}${probe.state ? ` (${probe.state})` : ""
             }, ${probe.country}, ${probe.continent}, ${probe.network
             } (AS${probe.asn})${tag ? `, (${tag})` : ""}`;
    }

    /**
     * @inheritdoc
     */
    formatResponse(probe, text) {
        return `${this.formatProbeLocation(probe)} : ${text}`;
    }

    /**
     * @inheritdoc
     */
    async getOauth2AuthHeader(monitor) {
        if (monitor.auth_method !== "oauth2-cc") {
            return {};
        }

        try {
            if (monitor.oauthAccessToken === undefined || new Date(monitor.oauthAccessToken.expires_at * 1000) <= new Date()) {
                log.debug("monitor", `[${monitor.name}] The oauth access-token undefined or expired. Requesting a new token`);
                const oAuthAccessToken = await getOidcTokenClientCredentials(monitor.oauth_token_url, monitor.oauth_client_id, monitor.oauth_client_secret, monitor.oauth_scopes, monitor.oauth_audience, monitor.oauth_auth_method);
                if (monitor.oauthAccessToken?.expires_at) {
                    log.debug("monitor", `[${monitor.name}] Obtained oauth access-token. Expires at ${new Date(monitor.oauthAccessToken?.expires_at * 1000)}`);
                } else {
                    log.debug("monitor", `[${monitor.name}] Obtained oauth access-token. Time until expiry was not provided`);
                }

                monitor.oauthAccessToken = oAuthAccessToken;
            }
            return {
                "Authorization": monitor.oauthAccessToken.token_type + " " + monitor.oauthAccessToken.access_token,
            };
        } catch (e) {
            throw new Error("The oauth config is invalid. " + e.message);
        }
    }

    /**
     * @inheritdoc
     */
    getBasicAuthHeader(monitor) {
        if (monitor.auth_method !== "basic") {
            return {};
        }

        return {
            "Authorization": "Basic " + encodeBase64(monitor.basic_auth_user, monitor.basic_auth_pass),
        };
    }

    /**
     * @inheritdoc
     */
    async handleTLSInfo(monitor, protocol, tlsInfo) {
        if (!tlsInfo) {
            return;
        }

        if (!monitor.ignoreTls && protocol === "HTTPS" && !tlsInfo.authorized) {
            throw new Error(this.formatResponse(`TLS certificate is not authorized: ${tlsInfo.error}`));
        }

        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            monitor.id,
        ]);

        if (tlsInfoBean == null) {
            tlsInfoBean = R.dispense("monitor_tls_info");
            tlsInfoBean.monitor_id = monitor.id;
        } else {
            try {
                let oldCertInfo = JSON.parse(tlsInfoBean.info_json);

                if (oldCertInfo && oldCertInfo.certInfo && oldCertInfo.certInfo.fingerprint256 !== tlsInfo.fingerprint256) {
                    log.debug("monitor", "Resetting sent_history");
                    await R.exec("DELETE FROM notification_sent_history WHERE type = 'certificate' AND monitor_id = ?", [
                        monitor.id
                    ]);
                }
            } catch (e) {}
        }

        const validTo = new Date(tlsInfo.expiresAt);
        const certResult = {
            valid: tlsInfo.authorized,
            certInfo: {
                subject: tlsInfo.subject,
                issuer: tlsInfo.issuer,
                validTo: validTo,
                daysRemaining: getDaysRemaining(new Date(), validTo),
                fingerprint: tlsInfo.fingerprint256,
                fingerprint256: tlsInfo.fingerprint256,
                certType: "",
            }
        };

        tlsInfoBean.info_json = JSON.stringify(certResult);
        await R.store(tlsInfoBean);

        if (monitor.prometheus) {
            monitor.prometheus.update(null, certResult);
        }

        if (!monitor.ignoreTls && monitor.expiryNotification) {
            await checkCertExpiryNotifications(monitor, certResult);
        }
    }
}

module.exports = {
    GlobalpingMonitorType,
};
