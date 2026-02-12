const { MonitorType } = require("./monitor-type");
const { UP, log, evaluateJsonQuery } = require("../../src/util");
const {
    checkCertificate,
    checkStatusCode,
    axiosAbortSignal,
    checkCertificateHostname,
    encodeBase64,
} = require("../util-server");
const { Proxy } = require("../proxy");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const crypto = require("crypto");
const { CookieJar } = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const http = require("http");

class HttpMonitorType extends MonitorType {
    name = "http";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        // Do not do any queries/high loading things before the "heartbeat.ping"
        let startTime = dayjs().valueOf();

            // HTTP basic auth
            let basicAuthHeader = {};
            if (monitor.auth_method === "basic") {
                basicAuthHeader = {
                    Authorization: "Basic " + encodeBase64(monitor.basic_auth_user, monitor.basic_auth_pass),
                };
            }

            // OIDC: Basic client credential flow.
            // Additional grants might be implemented in the future
            let oauth2AuthHeader = {};
            if (monitor.auth_method === "oauth2-cc") {
                try {
                    if (
                        monitor.oauthAccessToken === undefined ||
                        new Date(monitor.oauthAccessToken.expires_at * 1000) <= new Date()
                    ) {
                        monitor.oauthAccessToken = await monitor.makeOidcTokenClientCredentialsRequest();
                    }
                    oauth2AuthHeader = {
                        Authorization:
                            monitor.oauthAccessToken.token_type + " " + monitor.oauthAccessToken.access_token,
                    };
                } catch (e) {
                    throw new Error("The oauth config is invalid. " + e.message);
                }
            }

            let agentFamily = undefined;
            if (monitor.ipFamily === "ipv4") {
                agentFamily = 4;
            }
            if (monitor.ipFamily === "ipv6") {
                agentFamily = 6;
            }

            const httpsAgentOptions = {
                maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                rejectUnauthorized: !monitor.getIgnoreTls(),
                secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                autoSelectFamily: true,
                ...(agentFamily ? { family: agentFamily } : {}),
            };

            const httpAgentOptions = {
                maxCachedSessions: 0,
                autoSelectFamily: true,
                ...(agentFamily ? { family: agentFamily } : {}),
            };

            log.debug("monitor", `[${monitor.name}] Prepare Options for axios`);

            let contentType = null;
            let bodyValue = null;

            if (monitor.body && typeof monitor.body === "string" && monitor.body.trim().length > 0) {
                if (!monitor.httpBodyEncoding || monitor.httpBodyEncoding === "json") {
                    try {
                        bodyValue = JSON.parse(monitor.body);
                        contentType = "application/json";
                    } catch (e) {
                        throw new Error("Your JSON body is invalid. " + e.message);
                    }
                } else if (monitor.httpBodyEncoding === "form") {
                    bodyValue = monitor.body;
                    contentType = "application/x-www-form-urlencoded";
                } else if (monitor.httpBodyEncoding === "xml") {
                    bodyValue = monitor.body;
                    contentType = "text/xml; charset=utf-8";
                }
            }

            // Axios Options
            const options = {
                url: monitor.url,
                method: (monitor.method || "get").toLowerCase(),
                timeout: monitor.timeout * 1000,
                headers: {
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    ...(contentType ? { "Content-Type": contentType } : {}),
                    ...basicAuthHeader,
                    ...oauth2AuthHeader,
                    ...(monitor.headers ? JSON.parse(monitor.headers) : {}),
                },
                maxRedirects: monitor.maxredirects,
                validateStatus: (status) => {
                    return checkStatusCode(status, monitor.getAcceptedStatuscodes());
                },
                signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
            };

            if (bodyValue) {
                options.data = bodyValue;
            }

            if (monitor.cacheBust) {
                const randomFloatString = Math.random().toString(36);
                const cacheBust = randomFloatString.substring(2);
                options.params = {
                    uptime_kuma_cachebuster: cacheBust,
                };
            }

            if (monitor.proxy_id) {
                const proxy = await R.load("proxy", monitor.proxy_id);

                if (proxy && proxy.active) {
                    const { httpAgent, httpsAgent } = Proxy.createAgents(proxy, {
                        httpsAgentOptions: httpsAgentOptions,
                        httpAgentOptions: httpAgentOptions,
                    });

                    options.proxy = false;
                    options.httpAgent = httpAgent;
                    options.httpsAgent = httpsAgent;
                }
            }

            if (!options.httpAgent) {
                options.httpAgent = new http.Agent(httpAgentOptions);
            }

            if (!options.httpsAgent) {
                let jar = new CookieJar();
                let httpsCookieAgentOptions = {
                    ...httpsAgentOptions,
                    cookies: { jar },
                };
                options.httpsAgent = new HttpsCookieAgent(httpsCookieAgentOptions);
            }

            if (monitor.auth_method === "mtls") {
                if (monitor.tlsCert !== null && monitor.tlsCert !== "") {
                    options.httpsAgent.options.cert = Buffer.from(monitor.tlsCert);
                }
                if (monitor.tlsCa !== null && monitor.tlsCa !== "") {
                    options.httpsAgent.options.ca = Buffer.from(monitor.tlsCa);
                }
                if (monitor.tlsKey !== null && monitor.tlsKey !== "") {
                    options.httpsAgent.options.key = Buffer.from(monitor.tlsKey);
                }
            }

            let tlsInfo = {};
            // Store tlsInfo when secureConnect event is emitted
            // The keylog event listener is a workaround to access the tlsSocket
            options.httpsAgent.once("keylog", async (line, tlsSocket) => {
                tlsSocket.once("secureConnect", async () => {
                    tlsInfo = checkCertificate(tlsSocket);
                    tlsInfo.valid = tlsSocket.authorized || false;
                    tlsInfo.hostnameMatchMonitorUrl = checkCertificateHostname(
                        tlsInfo.certInfo.raw,
                        monitor.getUrl()?.hostname
                    );
                    await monitor.handleTlsInfo(tlsInfo);
                });
            });

            log.debug("monitor", `[${monitor.name}] Axios Options: ${JSON.stringify(options)}`);
            log.debug("monitor", `[${monitor.name}] Axios Request`);

            // Make Request
            let res = await monitor.makeAxiosRequest(options);

            heartbeat.msg = `${res.status} - ${res.statusText}`;
            heartbeat.ping = dayjs().valueOf() - startTime;

            // in the frontend, the save response is only shown if the saveErrorResponse is set
            if (monitor.getSaveResponse() && monitor.getSaveErrorResponse()) {
                await monitor.saveResponseData(heartbeat, res.data);
            }

            // fallback for if keylog event is not emitted, but we may still have tlsInfo,
            // e.g. if the connection is made through a proxy
            if (monitor.getUrl()?.protocol === "https:" && tlsInfo.valid === undefined) {
                const tlsSocket = res.request.res.socket;

                if (tlsSocket) {
                    tlsInfo = checkCertificate(tlsSocket);
                    tlsInfo.valid = tlsSocket.authorized || false;
                    tlsInfo.hostnameMatchMonitorUrl = checkCertificateHostname(
                        tlsInfo.certInfo.raw,
                        monitor.getUrl()?.hostname
                    );

                    await monitor.handleTlsInfo(tlsInfo);
                }
            }

            // eslint-disable-next-line eqeqeq
            if (process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID == monitor.id) {
                log.info("monitor", res.data);
            }

            if (monitor.type === "http") {
                heartbeat.status = UP;
            } else if (monitor.type === "keyword") {
                let data = res.data;

                // Convert to string for object/array
                if (typeof data !== "string") {
                    data = JSON.stringify(data);
                }

                let keywordFound = data.includes(monitor.keyword);
                if (keywordFound === !monitor.isInvertKeyword()) {
                    heartbeat.msg += ", keyword " + (keywordFound ? "is" : "not") + " found";
                    heartbeat.status = UP;
                } else {
                    data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
                    if (data.length > 50) {
                        data = data.substring(0, 47) + "...";
                    }
                    throw new Error(
                        heartbeat.msg +
                            ", but keyword is " +
                            (keywordFound ? "present" : "not") +
                            " in [" +
                            data +
                            "]"
                    );
                }
            } else if (monitor.type === "json-query") {
                let data = res.data;

                const { status, response } = await evaluateJsonQuery(
                    data,
                    monitor.jsonPath,
                    monitor.jsonPathOperator,
                    monitor.expectedValue
                );

                if (status) {
                    heartbeat.status = UP;
                    heartbeat.msg = `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`;
                } else {
                    throw new Error(
                        `JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`
                    );
                }
            }
    }
}

module.exports = {
    HttpMonitorType,
};
