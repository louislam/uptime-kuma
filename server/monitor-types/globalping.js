const { MonitorType } = require("./monitor-type");
const { Globalping, IpVersion } = require("globalping");
const { Settings } = require("../settings");
const { log, UP, DOWN, evaluateJsonQuery } = require("../../src/util");
const {
    checkStatusCode,
    getOidcTokenClientCredentials,
    encodeBase64,
    getDaysRemaining,
    checkCertExpiryNotifications,
} = require("../util-server");
const { R } = require("redbean-node");

/**
 * Globalping is a free and open-source tool that allows you to run network tests
 * and measurements from thousands of community hosted probes around the world.
 *
 * Library documentation: https://github.com/jsdelivr/globalping-typescript
 *
 * API documentation: https://globalping.io/docs/api.globalping.io
 */
class GlobalpingMonitorType extends MonitorType {
    name = "globalping";

    httpUserAgent = "";

    /**
     * @inheritdoc
     */
    constructor(httpUserAgent) {
        super();
        this.httpUserAgent = httpUserAgent;
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const apiKey = await Settings.get("globalpingApiToken");
        const client = new Globalping({
            auth: apiKey,
            agent: this.httpUserAgent,
        });

        const hasAPIToken = !!apiKey;
        switch (monitor.subtype) {
            case "ping":
                await this.ping(client, monitor, heartbeat, hasAPIToken);
                break;
            case "http":
                await this.http(client, monitor, heartbeat, hasAPIToken);
                break;
        }
    }

    /**
     * Handles ping monitors.
     * @param {Client} client - The client object.
     * @param {Monitor} monitor - The monitor object.
     * @param {Heartbeat} heartbeat - The heartbeat object.
     * @param {boolean} hasAPIToken - Whether the monitor has an API token.
     * @returns {Promise<void>} A promise that resolves when the ping monitor is handled.
     */
    async ping(client, monitor, heartbeat, hasAPIToken) {
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
            if (Globalping.isHttpStatus(429, res)) {
                throw new Error(`Failed to create measurement: ${this.formatTooManyRequestsError(hasAPIToken)}`);
            }
            throw new Error(`Failed to create measurement: ${this.formatApiError(res.data.error)}`);
        }

        log.debug("monitor", `Globalping fetch measurement: ${res.data.id}`);
        let measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            throw new Error(
                `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`
            );
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
     * Handles HTTP monitors.
     * @param {Client} client - The client object.
     * @param {Monitor} monitor - The monitor object.
     * @param {Heartbeat} heartbeat - The heartbeat object.
     * @param {boolean} hasAPIToken - Whether the monitor has an API token.
     * @returns {Promise<void>} A promise that resolves when the HTTP monitor is handled.
     */
    async http(client, monitor, heartbeat, hasAPIToken) {
        const url = new URL(monitor.url);

        let protocol = url.protocol.replace(":", "").toUpperCase();
        if (monitor.protocol === "HTTP2") {
            protocol = "HTTP2";
        }

        const basicAuthHeader = this.getBasicAuthHeader(monitor);
        const oauth2AuthHeader = await this.getOauth2AuthHeader(monitor);
        const headers = {
            ...basicAuthHeader,
            ...oauth2AuthHeader,
            ...(monitor.headers ? JSON.parse(monitor.headers) : {}),
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
                    method: monitor.method,
                    headers,
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
            if (Globalping.isHttpStatus(429, res)) {
                throw new Error(`Failed to create measurement: ${this.formatTooManyRequestsError(hasAPIToken)}`);
            }
            throw new Error(`Failed to create measurement: ${this.formatApiError(res.data.error)}`);
        }

        log.debug("monitor", `Globalping fetch measurement: ${res.data.id}`);
        let measurement = await client.awaitMeasurement(res.data.id);

        if (!measurement.ok) {
            throw new Error(
                `Failed to fetch measurement (${res.data.id}): ${this.formatApiError(measurement.data.error)}`
            );
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
            heartbeat.msg = this.formatResponse(
                probe,
                `Status code ${result.statusCode} not accepted. Output: ${result.rawOutput}`
            );
            heartbeat.status = DOWN;
            return;
        }

        heartbeat.msg = this.formatResponse(probe, `${result.statusCode} - ${result.statusCodeName}`);

        // keyword
        if (monitor.keyword) {
            await this.handleKeywordForHTTP(monitor, heartbeat, result, probe);
            return;
        }

        // json-query
        if (monitor.expectedValue) {
            await this.handleJSONQueryForHTTP(monitor, heartbeat, result, probe);
            return;
        }

        await this.handleTLSInfo(monitor, protocol, probe, result.tls);

        heartbeat.msg = this.formatResponse(probe, "OK");
        heartbeat.status = UP;
    }

    /**
     * Handles keyword for HTTP monitors.
     * @param {Monitor} monitor - The monitor object.
     * @param {Heartbeat} heartbeat - The heartbeat object.
     * @param {Result} result - The result object.
     * @param {Probe} probe - The probe object.
     * @returns {Promise<void>} A promise that resolves when the keyword is handled.
     */
    async handleKeywordForHTTP(monitor, heartbeat, result, probe) {
        let data = result.rawOutput;
        let keywordFound = data.includes(monitor.keyword);

        if (keywordFound === Boolean(monitor.invertKeyword)) {
            data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
            if (data.length > 50) {
                data = data.substring(0, 47) + "...";
            }
            throw new Error(
                heartbeat.msg + ", but keyword is " + (keywordFound ? "present" : "not") + " in [" + data + "]"
            );
        }

        heartbeat.msg += ", keyword " + (keywordFound ? "is" : "not") + " found";
        heartbeat.status = UP;
    }

    /**
     * Handles JSON query for HTTP monitors.
     * @param {Monitor} monitor - The monitor object.
     * @param {Heartbeat} heartbeat - The heartbeat object.
     * @param {Result} result - The result object.
     * @param {Probe} probe - The probe object.
     * @returns {Promise<void>} A promise that resolves when the JSON query is handled.
     */
    async handleJSONQueryForHTTP(monitor, heartbeat, result, probe) {
        const { status, response } = await evaluateJsonQuery(
            result.rawOutput,
            monitor.jsonPath,
            monitor.jsonPathOperator,
            monitor.expectedValue
        );

        if (!status) {
            throw new Error(
                this.formatResponse(
                    probe,
                    `JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`
                )
            );
        }

        heartbeat.msg = this.formatResponse(
            probe,
            `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`
        );
        heartbeat.status = UP;
    }

    /**
     * Updates the TLS information for a monitor.
     * @param {object} monitor - The monitor object.
     * @param {string} protocol - The protocol used for the monitor.
     * @param {object} probe - The probe object containing location information.
     * @param {object} tlsInfo - The TLS information object.
     * @returns {Promise<void>}
     */
    async handleTLSInfo(monitor, protocol, probe, tlsInfo) {
        if (!tlsInfo) {
            return;
        }

        if (!monitor.ignoreTls && protocol === "HTTPS" && !tlsInfo.authorized) {
            throw new Error(this.formatResponse(probe, `TLS certificate is not authorized: ${tlsInfo.error}`));
        }

        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [monitor.id]);

        if (tlsInfoBean == null) {
            tlsInfoBean = R.dispense("monitor_tls_info");
            tlsInfoBean.monitor_id = monitor.id;
        } else {
            try {
                let oldCertInfo = JSON.parse(tlsInfoBean.info_json);

                if (
                    oldCertInfo &&
                    oldCertInfo.certInfo &&
                    oldCertInfo.certInfo.fingerprint256 !== tlsInfo.fingerprint256
                ) {
                    log.debug("monitor", "Resetting sent_history");
                    await R.exec(
                        "DELETE FROM notification_sent_history WHERE type = 'certificate' AND monitor_id = ?",
                        [monitor.id]
                    );
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
            },
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

    /**
     * Generates the OAuth2 authorization header for the monitor if it is enabled.
     * @param {object} monitor - The monitor object containing authentication information.
     * @returns {Promise<object>} The OAuth2 authorization header.
     */
    async getOauth2AuthHeader(monitor) {
        if (monitor.auth_method !== "oauth2-cc") {
            return {};
        }

        try {
            if (new Date((monitor.oauthAccessToken?.expires_at || 0) * 1000) <= new Date()) {
                const oAuthAccessToken = await getOidcTokenClientCredentials(
                    monitor.oauth_token_url,
                    monitor.oauth_client_id,
                    monitor.oauth_client_secret,
                    monitor.oauth_scopes,
                    monitor.oauth_audience,
                    monitor.oauth_auth_method
                );
                log.debug(
                    "monitor",
                    `[${monitor.name}] Obtained oauth access-token. Expires at ${new Date(oAuthAccessToken.expires_at * 1000)}`
                );

                monitor.oauthAccessToken = oAuthAccessToken;
            }
            return {
                Authorization: monitor.oauthAccessToken.token_type + " " + monitor.oauthAccessToken.access_token,
            };
        } catch (e) {
            throw new Error("The oauth config is invalid. " + e.message);
        }
    }

    /**
     * Generates the basic authentication header for a monitor if it is enabled.
     * @param {object} monitor - The monitor object.
     * @returns {object} The basic authentication header.
     */
    getBasicAuthHeader(monitor) {
        if (monitor.auth_method !== "basic") {
            return {};
        }

        return {
            Authorization: "Basic " + encodeBase64(monitor.basic_auth_user, monitor.basic_auth_pass),
        };
    }

    /**
     * Generates a formatted error message for API errors.
     * @param {Error} error - The API error object.
     * @returns {string} The formatted error message.
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
     * Generates a formatted error message for too many requests.
     * @param {boolean} hasAPIToken - Indicates whether an API token is available.
     * @returns {string} The formatted error message.
     */
    formatTooManyRequestsError(hasAPIToken) {
        const creditsHelpLink = "https://dash.globalping.io?view=add-credits";
        if (hasAPIToken) {
            return `You have run out of credits. Get higher limits by sponsoring us or hosting probes. Learn more at ${creditsHelpLink}.`;
        }
        return `You have run out of credits. Get higher limits by creating an account. Sign up at ${creditsHelpLink}.`;
    }

    /**
     * Returns the formatted probe location string. e.g "Ashburn (VA), US, NA, Amazon.com (AS14618), (aws-us-east-1)"
     * @param {object} probe - The probe object containing location information.
     * @returns {string} The formatted probe location string.
     */
    formatProbeLocation(probe) {
        let tag = "";

        for (const t of probe.tags) {
            // If tag ends in a number, it's likely a region code and should be displayed
            if (Number.isInteger(Number(t.slice(-1)))) {
                tag = t;
                break;
            }
        }
        return `${probe.city}${probe.state ? ` (${probe.state})` : ""}, ${probe.country}, ${probe.continent}, ${
            probe.network
        } (AS${probe.asn})${tag ? `, (${tag})` : ""}`;
    }

    /**
     * Formats the response text with the probe location.
     * @param {object} probe - The probe object containing location information.
     * @param {string} text - The response text to append.
     * @returns {string} The formatted response text.
     */
    formatResponse(probe, text) {
        return `${this.formatProbeLocation(probe)} : ${text}`;
    }
}

module.exports = {
    GlobalpingMonitorType,
};
