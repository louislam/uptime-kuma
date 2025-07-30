const dayjs = require("dayjs");
const axios = require("axios");
const { Prometheus } = require("../prometheus");
const { log, UP, DOWN, PENDING, MAINTENANCE, flipStatus, MAX_INTERVAL_SECOND, MIN_INTERVAL_SECOND,
    SQL_DATETIME_FORMAT, evaluateJsonQuery,
    PING_PACKET_SIZE_MIN, PING_PACKET_SIZE_MAX, PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_MIN, PING_GLOBAL_TIMEOUT_MAX, PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_MIN, PING_COUNT_MAX, PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_MIN, PING_PER_REQUEST_TIMEOUT_MAX, PING_PER_REQUEST_TIMEOUT_DEFAULT
} = require("../../src/util");
const { tcping, ping, checkCertificate, checkStatusCode, getTotalClientInRoom, setting, mssqlQuery, postgresQuery, mysqlQuery, setSetting, httpNtlm, radius, grpcQuery,
    redisPingAsync, kafkaProducerAsync, getOidcTokenClientCredentials, rootCertificatesFingerprints, axiosAbortSignal
} = require("../util-server");
const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const { Notification } = require("../notification");
const { Proxy } = require("../proxy");
const { demoMode } = require("../config");
const version = require("../../package.json").version;
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { DockerHost } = require("../docker");
const Gamedig = require("gamedig");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { UptimeCalculator } = require("../uptime-calculator");
const { CookieJar } = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const https = require("https");
const http = require("http");

const rootCertificates = rootCertificatesFingerprints();

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 *      3 = MAINTENANCE
 */
class Monitor extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public Only show
     * necessary data to public
     * @param {boolean} showTags Include tags in JSON
     * @param {boolean} certExpiry Include certificate expiry info in
     * JSON
     * @returns {Promise<object>} Object ready to parse
     */
    async toPublicJSON(showTags = false, certExpiry = false) {
        let obj = {
            id: this.id,
            name: this.name,
            sendUrl: this.sendUrl,
            type: this.type,
        };

        if (this.sendUrl) {
            obj.url = this.customUrl ?? this.url;
        }

        if (showTags) {
            obj.tags = await this.getTags();
        }

        if (certExpiry && (this.type === "http" || this.type === "keyword" || this.type === "json-query") && this.getURLProtocol() === "https:") {
            const { certExpiryDaysRemaining, validCert } = await this.getCertExpiry(this.id);
            obj.certExpiryDaysRemaining = certExpiryDaysRemaining;
            obj.validCert = validCert;
        }

        return obj;
    }

    /**
     * Return an object that ready to parse to JSON
     * @param {object} preloadData to prevent n+1 problems, we query the data in a batch outside of this function
     * @param {boolean} includeSensitiveData Include sensitive data in
     * JSON
     * @returns {object} Object ready to parse
     */
    toJSON(preloadData = {}, includeSensitiveData = true) {

        let screenshot = null;

        if (this.type === "real-browser") {
            screenshot = "/screenshots/" + jwt.sign(this.id, UptimeKumaServer.getInstance().jwtSecret) + ".png";
        }

        const path = preloadData.paths.get(this.id) || [];
        const pathName = path.join(" / ");

        let data = {
            id: this.id,
            name: this.name,
            description: this.description,
            path,
            pathName,
            parent: this.parent,
            childrenIDs: preloadData.childrenIDs.get(this.id) || [],
            url: this.url,
            method: this.method,
            hostname: this.hostname,
            port: this.port,
            maxretries: this.maxretries,
            weight: this.weight,
            active: preloadData.activeStatus.get(this.id),
            forceInactive: preloadData.forceInactive.get(this.id),
            type: this.type,
            timeout: this.timeout,
            interval: this.interval,
            retryInterval: this.retryInterval,
            resendInterval: this.resendInterval,
            keyword: this.keyword,
            invertKeyword: this.isInvertKeyword(),
            expiryNotification: this.isEnabledExpiryNotification(),
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            packetSize: this.packetSize,
            maxredirects: this.maxredirects,
            accepted_statuscodes: this.getAcceptedStatuscodes(),
            dns_resolve_type: this.dns_resolve_type,
            dns_resolve_server: this.dns_resolve_server,
            dns_last_result: this.dns_last_result,
            docker_container: this.docker_container,
            docker_host: this.docker_host,
            proxyId: this.proxy_id,
            notificationIDList: preloadData.notifications.get(this.id) || {},
            tags: preloadData.tags.get(this.id) || [],
            maintenance: preloadData.maintenanceStatus.get(this.id),
            mqttTopic: this.mqttTopic,
            mqttSuccessMessage: this.mqttSuccessMessage,
            mqttCheckType: this.mqttCheckType,
            databaseQuery: this.databaseQuery,
            authMethod: this.authMethod,
            grpcUrl: this.grpcUrl,
            grpcProtobuf: this.grpcProtobuf,
            grpcMethod: this.grpcMethod,
            grpcServiceName: this.grpcServiceName,
            grpcEnableTls: this.getGrpcEnableTls(),
            radiusCalledStationId: this.radiusCalledStationId,
            radiusCallingStationId: this.radiusCallingStationId,
            game: this.game,
            gamedigGivenPortOnly: this.getGameDigGivenPortOnly(),
            httpBodyEncoding: this.httpBodyEncoding,
            jsonPath: this.jsonPath,
            expectedValue: this.expectedValue,
            kafkaProducerTopic: this.kafkaProducerTopic,
            kafkaProducerBrokers: JSON.parse(this.kafkaProducerBrokers),
            kafkaProducerSsl: this.getKafkaProducerSsl(),
            kafkaProducerAllowAutoTopicCreation: this.getKafkaProducerAllowAutoTopicCreation(),
            kafkaProducerMessage: this.kafkaProducerMessage,
            screenshot,
            cacheBust: this.getCacheBust(),
            remote_browser: this.remote_browser,
            snmpOid: this.snmpOid,
            jsonPathOperator: this.jsonPathOperator,
            snmpVersion: this.snmpVersion,
            smtpSecurity: this.smtpSecurity,
            rabbitmqNodes: JSON.parse(this.rabbitmqNodes),
            conditions: JSON.parse(this.conditions),
            ipFamily: this.ipFamily,

            // ping advanced options
            ping_numeric: this.isPingNumeric(),
            ping_count: this.ping_count,
            ping_per_request_timeout: this.ping_per_request_timeout,
        };

        if (includeSensitiveData) {
            data = {
                ...data,
                headers: this.headers,
                body: this.body,
                grpcBody: this.grpcBody,
                grpcMetadata: this.grpcMetadata,
                basic_auth_user: this.basic_auth_user,
                basic_auth_pass: this.basic_auth_pass,
                oauth_client_id: this.oauth_client_id,
                oauth_client_secret: this.oauth_client_secret,
                oauth_token_url: this.oauth_token_url,
                oauth_scopes: this.oauth_scopes,
                oauth_audience: this.oauth_audience,
                oauth_auth_method: this.oauth_auth_method,
                pushToken: this.pushToken,
                databaseConnectionString: this.databaseConnectionString,
                radiusUsername: this.radiusUsername,
                radiusPassword: this.radiusPassword,
                radiusSecret: this.radiusSecret,
                mqttUsername: this.mqttUsername,
                mqttPassword: this.mqttPassword,
                mqttWebsocketPath: this.mqttWebsocketPath,
                authWorkstation: this.authWorkstation,
                authDomain: this.authDomain,
                tlsCa: this.tlsCa,
                tlsCert: this.tlsCert,
                tlsKey: this.tlsKey,
                kafkaProducerSaslOptions: JSON.parse(this.kafkaProducerSaslOptions),
                rabbitmqUsername: this.rabbitmqUsername,
                rabbitmqPassword: this.rabbitmqPassword,
            };
        }

        data.includeSensitiveData = includeSensitiveData;
        return data;
    }

    /**
     * Get all tags applied to this monitor
     * @returns {Promise<LooseObject<any>[]>} List of tags on the
     * monitor
     */
    async getTags() {
        return await R.getAll("SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ? ORDER BY tag.name", [ this.id ]);
    }

    /**
     * Gets certificate expiry for this monitor
     * @param {number} monitorID ID of monitor to send
     * @returns {Promise<LooseObject<any>>} Certificate expiry info for
     * monitor
     */
    async getCertExpiry(monitorID) {
        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            monitorID,
        ]);
        let tlsInfo;
        if (tlsInfoBean) {
            tlsInfo = JSON.parse(tlsInfoBean?.info_json);
            if (tlsInfo?.valid && tlsInfo?.certInfo?.daysRemaining) {
                return {
                    certExpiryDaysRemaining: tlsInfo.certInfo.daysRemaining,
                    validCert: true
                };
            }
        }
        return {
            certExpiryDaysRemaining: "",
            validCert: false
        };
    }

    /**
     * Encode user and password to Base64 encoding
     * for HTTP "basic" auth, as per RFC-7617
     * @param {string|null} user - The username (nullable if not changed by a user)
     * @param {string|null} pass - The password (nullable if not changed by a user)
     * @returns {string} Encoded Base64 string
     */
    encodeBase64(user, pass) {
        return Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
    }

    /**
     * Is the TLS expiry notification enabled?
     * @returns {boolean} Enabled?
     */
    isEnabledExpiryNotification() {
        return Boolean(this.expiryNotification);
    }

    /**
     * Check if ping should use numeric output only
     * @returns {boolean} True if IP addresses will be output instead of symbolic hostnames
     */
    isPingNumeric() {
        return Boolean(this.ping_numeric);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should TLS errors be ignored?
     */
    getIgnoreTls() {
        return Boolean(this.ignoreTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Is the monitor in upside down mode?
     */
    isUpsideDown() {
        return Boolean(this.upsideDown);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Invert keyword match?
     */
    isInvertKeyword() {
        return Boolean(this.invertKeyword);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Enable TLS for gRPC?
     */
    getGrpcEnableTls() {
        return Boolean(this.grpcEnableTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} if cachebusting is enabled
     */
    getCacheBust() {
        return Boolean(this.cacheBust);
    }

    /**
     * Get accepted status codes
     * @returns {object} Accepted status codes
     */
    getAcceptedStatuscodes() {
        return JSON.parse(this.accepted_statuscodes_json);
    }

    /**
     * Get if game dig should only use the port which was provided
     * @returns {boolean} gamedig should only use the provided port
     */
    getGameDigGivenPortOnly() {
        return Boolean(this.gamedigGivenPortOnly);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Ssl enabled?
     */
    getKafkaProducerSsl() {
        return Boolean(this.kafkaProducerSsl);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Allow Auto Topic Creation Enabled?
     */
    getKafkaProducerAllowAutoTopicCreation() {
        return Boolean(this.kafkaProducerAllowAutoTopicCreation);
    }

    /**
     * Start monitor
     * @param {Server} io Socket server instance
     * @returns {Promise<void>}
     */
    async start(io) {
        let previousBeat = null;
        let retries = 0;

        this.prometheus = new Prometheus(this);

        const beat = async () => {

            let beatInterval = this.interval;

            if (! beatInterval) {
                beatInterval = 1;
            }

            if (demoMode) {
                if (beatInterval < 20) {
                    console.log("beat interval too low, reset to 20s");
                    beatInterval = 20;
                }
            }

            // Expose here for prometheus update
            // undefined if not https
            let tlsInfo = undefined;

            if (!previousBeat || this.type === "push") {
                previousBeat = await R.findOne("heartbeat", " monitor_id = ? ORDER BY time DESC", [
                    this.id,
                ]);
                if (previousBeat) {
                    retries = previousBeat.retries;
                }
            }

            const isFirstBeat = !previousBeat;

            let bean = R.dispense("heartbeat");
            bean.monitor_id = this.id;
            bean.time = R.isoDateTimeMillis(dayjs.utc());
            bean.status = DOWN;
            bean.downCount = previousBeat?.downCount || 0;

            if (this.isUpsideDown()) {
                bean.status = flipStatus(bean.status);
            }

            // Runtime patch timeout if it is 0
            // See https://github.com/louislam/uptime-kuma/pull/3961#issuecomment-1804149144
            if (!this.timeout || this.timeout <= 0) {
                this.timeout = this.interval * 1000 * 0.8;
            }

            try {
                if (await Monitor.isUnderMaintenance(this.id)) {
                    bean.msg = "Monitor under maintenance";
                    bean.status = MAINTENANCE;
                } else if (this.type === "http" || this.type === "keyword" || this.type === "json-query") {
                    // Do not do any queries/high loading things before the "bean.ping"
                    let startTime = dayjs().valueOf();

                    // HTTP basic auth
                    let basicAuthHeader = {};
                    if (this.auth_method === "basic") {
                        basicAuthHeader = {
                            "Authorization": "Basic " + this.encodeBase64(this.basic_auth_user, this.basic_auth_pass),
                        };
                    }

                    // OIDC: Basic client credential flow.
                    // Additional grants might be implemented in the future
                    let oauth2AuthHeader = {};
                    if (this.auth_method === "oauth2-cc") {
                        try {
                            if (this.oauthAccessToken === undefined || new Date(this.oauthAccessToken.expires_at * 1000) <= new Date()) {
                                this.oauthAccessToken = await this.makeOidcTokenClientCredentialsRequest();
                            }
                            oauth2AuthHeader = {
                                "Authorization": this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                            };
                        } catch (e) {
                            throw new Error("The oauth config is invalid. " + e.message);
                        }
                    }

                    let agentFamily = undefined;
                    if (this.ipFamily === "ipv4") {
                        agentFamily = 4;
                    }
                    if (this.ipFamily === "ipv6") {
                        agentFamily = 6;
                    }

                    const httpsAgentOptions = {
                        maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                        rejectUnauthorized: !this.getIgnoreTls(),
                        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {})
                    };

                    const httpAgentOptions = {
                        maxCachedSessions: 0,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {})
                    };

                    log.debug("monitor", `[${this.name}] Prepare Options for axios`);

                    let contentType = null;
                    let bodyValue = null;

                    if (this.body && (typeof this.body === "string" && this.body.trim().length > 0)) {
                        if (!this.httpBodyEncoding || this.httpBodyEncoding === "json") {
                            try {
                                bodyValue = JSON.parse(this.body);
                                contentType = "application/json";
                            } catch (e) {
                                throw new Error("Your JSON body is invalid. " + e.message);
                            }
                        } else if (this.httpBodyEncoding === "form") {
                            bodyValue = this.body;
                            contentType = "application/x-www-form-urlencoded";
                        } else if (this.httpBodyEncoding === "xml") {
                            bodyValue = this.body;
                            contentType = "text/xml; charset=utf-8";
                        }
                    }

                    // Axios Options
                    const options = {
                        url: this.url,
                        method: (this.method || "get").toLowerCase(),
                        timeout: this.timeout * 1000,
                        headers: {
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            ...(contentType ? { "Content-Type": contentType } : {}),
                            ...(basicAuthHeader),
                            ...(oauth2AuthHeader),
                            ...(this.headers ? JSON.parse(this.headers) : {})
                        },
                        maxRedirects: this.maxredirects,
                        validateStatus: (status) => {
                            return checkStatusCode(status, this.getAcceptedStatuscodes());
                        },
                        signal: axiosAbortSignal((this.timeout + 10) * 1000),
                    };

                    if (bodyValue) {
                        options.data = bodyValue;
                    }

                    if (this.cacheBust) {
                        const randomFloatString = Math.random().toString(36);
                        const cacheBust = randomFloatString.substring(2);
                        options.params = {
                            uptime_kuma_cachebuster: cacheBust,
                        };
                    }

                    if (this.proxy_id) {
                        const proxy = await R.load("proxy", this.proxy_id);

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
                            cookies: { jar }
                        };
                        options.httpsAgent = new HttpsCookieAgent(httpsCookieAgentOptions);
                    }

                    if (this.auth_method === "mtls") {
                        if (this.tlsCert !== null && this.tlsCert !== "") {
                            options.httpsAgent.options.cert = Buffer.from(this.tlsCert);
                        }
                        if (this.tlsCa !== null && this.tlsCa !== "") {
                            options.httpsAgent.options.ca = Buffer.from(this.tlsCa);
                        }
                        if (this.tlsKey !== null && this.tlsKey !== "") {
                            options.httpsAgent.options.key = Buffer.from(this.tlsKey);
                        }
                    }

                    let tlsInfo = {};
                    // Store tlsInfo when secureConnect event is emitted
                    // The keylog event listener is a workaround to access the tlsSocket
                    options.httpsAgent.once("keylog", async (line, tlsSocket) => {
                        tlsSocket.once("secureConnect", async () => {
                            tlsInfo = checkCertificate(tlsSocket);
                            tlsInfo.valid = tlsSocket.authorized || false;

                            await this.handleTlsInfo(tlsInfo);
                        });
                    });

                    log.debug("monitor", `[${this.name}] Axios Options: ${JSON.stringify(options)}`);
                    log.debug("monitor", `[${this.name}] Axios Request`);

                    // Make Request
                    let res = await this.makeAxiosRequest(options);

                    bean.msg = `${res.status} - ${res.statusText}`;
                    bean.ping = dayjs().valueOf() - startTime;

                    // fallback for if kelog event is not emitted, but we may still have tlsInfo,
                    // e.g. if the connection is made through a proxy
                    if (this.getUrl()?.protocol === "https:" && tlsInfo.valid === undefined) {
                        const tlsSocket = res.request.res.socket;

                        if (tlsSocket) {
                            tlsInfo = checkCertificate(tlsSocket);
                            tlsInfo.valid = tlsSocket.authorized || false;

                            await this.handleTlsInfo(tlsInfo);
                        }
                    }

                    if (process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID === this.id) {
                        log.info("monitor", res.data);
                    }

                    if (this.type === "http") {
                        bean.status = UP;
                    } else if (this.type === "keyword") {

                        let data = res.data;

                        // Convert to string for object/array
                        if (typeof data !== "string") {
                            data = JSON.stringify(data);
                        }

                        let keywordFound = data.includes(this.keyword);
                        if (keywordFound === !this.isInvertKeyword()) {
                            bean.msg += ", keyword " + (keywordFound ? "is" : "not") + " found";
                            bean.status = UP;
                        } else {
                            data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
                            if (data.length > 50) {
                                data = data.substring(0, 47) + "...";
                            }
                            throw new Error(bean.msg + ", but keyword is " +
                                (keywordFound ? "present" : "not") + " in [" + data + "]");
                        }

                    } else if (this.type === "json-query") {
                        let data = res.data;

                        const { status, response } = await evaluateJsonQuery(data, this.jsonPath, this.jsonPathOperator, this.expectedValue);

                        if (status) {
                            bean.status = UP;
                            bean.msg = `JSON query passes (comparing ${response} ${this.jsonPathOperator} ${this.expectedValue})`;
                        } else {
                            throw new Error(`JSON query does not pass (comparing ${response} ${this.jsonPathOperator} ${this.expectedValue})`);
                        }

                    }

                } else if (this.type === "port") {
                    bean.ping = await tcping(this.hostname, this.port);
                    bean.msg = "";
                    bean.status = UP;

                } else if (this.type === "ping") {
                    bean.ping = await ping(this.hostname, this.ping_count, "", this.ping_numeric, this.packetSize, this.timeout, this.ping_per_request_timeout);
                    bean.msg = "";
                    bean.status = UP;
                } else if (this.type === "push") {      // Type: Push
                    log.debug("monitor", `[${this.name}] Checking monitor at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`);
                    const bufferTime = 1000; // 1s buffer to accommodate clock differences

                    if (previousBeat) {
                        const msSinceLastBeat = dayjs.utc().valueOf() - dayjs.utc(previousBeat.time).valueOf();

                        log.debug("monitor", `[${this.name}] msSinceLastBeat = ${msSinceLastBeat}`);

                        // If the previous beat was down or pending we use the regular
                        // beatInterval/retryInterval in the setTimeout further below
                        if (previousBeat.status !== (this.isUpsideDown() ? DOWN : UP) || msSinceLastBeat > beatInterval * 1000 + bufferTime) {
                            bean.duration = Math.round(msSinceLastBeat / 1000);
                            throw new Error("No heartbeat in the time window");
                        } else {
                            let timeout = beatInterval * 1000 - msSinceLastBeat;
                            if (timeout < 0) {
                                timeout = bufferTime;
                            } else {
                                timeout += bufferTime;
                            }
                            // No need to insert successful heartbeat for push type, so end here
                            retries = 0;
                            log.debug("monitor", `[${this.name}] timeout = ${timeout}`);
                            this.heartbeatInterval = setTimeout(safeBeat, timeout);
                            return;
                        }
                    } else {
                        bean.duration = beatInterval;
                        throw new Error("No heartbeat in the time window");
                    }

                } else if (this.type === "steam") {
                    const steamApiUrl = "https://api.steampowered.com/IGameServersService/GetServerList/v1/";
                    const steamAPIKey = await setting("steamAPIKey");
                    const filter = `addr\\${this.hostname}:${this.port}`;

                    if (!steamAPIKey) {
                        throw new Error("Steam API Key not found");
                    }

                    let res = await axios.get(steamApiUrl, {
                        timeout: this.timeout * 1000,
                        headers: {
                            "Accept": "*/*",
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
                            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        }),
                        httpAgent: new http.Agent({
                            maxCachedSessions: 0,
                        }),
                        maxRedirects: this.maxredirects,
                        validateStatus: (status) => {
                            return checkStatusCode(status, this.getAcceptedStatuscodes());
                        },
                        params: {
                            filter: filter,
                            key: steamAPIKey,
                        }
                    });

                    if (res.data.response && res.data.response.servers && res.data.response.servers.length > 0) {
                        bean.status = UP;
                        bean.msg = res.data.response.servers[0].name;

                        try {
                            bean.ping = await ping(this.hostname, PING_COUNT_DEFAULT, "", true, this.packetSize, PING_GLOBAL_TIMEOUT_DEFAULT, PING_PER_REQUEST_TIMEOUT_DEFAULT);
                        } catch (_) { }
                    } else {
                        throw new Error("Server not found on Steam");
                    }
                } else if (this.type === "gamedig") {
                    try {
                        const state = await Gamedig.query({
                            type: this.game,
                            host: this.hostname,
                            port: this.port,
                            givenPortOnly: this.getGameDigGivenPortOnly(),
                        });

                        bean.msg = state.name;
                        bean.status = UP;
                        bean.ping = state.ping;
                    } catch (e) {
                        throw new Error(e.message);
                    }
                } else if (this.type === "docker") {
                    log.debug("monitor", `[${this.name}] Prepare Options for Axios`);

                    const options = {
                        url: `/containers/${this.docker_container}/json`,
                        timeout: this.interval * 1000 * 0.8,
                        headers: {
                            "Accept": "*/*",
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
                            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        }),
                        httpAgent: new http.Agent({
                            maxCachedSessions: 0,
                        }),
                    };

                    const dockerHost = await R.load("docker_host", this.docker_host);

                    if (!dockerHost) {
                        throw new Error("Failed to load docker host config");
                    }

                    if (dockerHost._dockerType === "socket") {
                        options.socketPath = dockerHost._dockerDaemon;
                    } else if (dockerHost._dockerType === "tcp") {
                        options.baseURL = DockerHost.patchDockerURL(dockerHost._dockerDaemon);
                        options.httpsAgent = new https.Agent(
                            await DockerHost.getHttpsAgentOptions(dockerHost._dockerType, options.baseURL)
                        );
                    }

                    log.debug("monitor", `[${this.name}] Axios Request`);
                    let res = await axios.request(options);

                    if (res.data.State.Running) {
                        if (res.data.State.Health && res.data.State.Health.Status !== "healthy") {
                            bean.status = PENDING;
                            bean.msg = res.data.State.Health.Status;
                        } else {
                            bean.status = UP;
                            bean.msg = res.data.State.Health ? res.data.State.Health.Status : res.data.State.Status;
                        }
                    } else {
                        throw Error("Container State is " + res.data.State.Status);
                    }
                } else if (this.type === "sqlserver") {
                    let startTime = dayjs().valueOf();

                    await mssqlQuery(this.databaseConnectionString, this.databaseQuery || "SELECT 1");

                    bean.msg = "";
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type === "grpc-keyword") {
                    let startTime = dayjs().valueOf();
                    const options = {
                        grpcUrl: this.grpcUrl,
                        grpcProtobufData: this.grpcProtobuf,
                        grpcServiceName: this.grpcServiceName,
                        grpcEnableTls: this.grpcEnableTls,
                        grpcMethod: this.grpcMethod,
                        grpcBody: this.grpcBody,
                    };
                    const response = await grpcQuery(options);
                    bean.ping = dayjs().valueOf() - startTime;
                    log.debug("monitor:", `gRPC response: ${JSON.stringify(response)}`);
                    let responseData = response.data;
                    if (responseData.length > 50) {
                        responseData = responseData.toString().substring(0, 47) + "...";
                    }
                    if (response.code !== 1) {
                        bean.status = DOWN;
                        bean.msg = `Error in send gRPC ${response.code} ${response.errorMessage}`;
                    } else {
                        let keywordFound = response.data.toString().includes(this.keyword);
                        if (keywordFound === !this.isInvertKeyword()) {
                            bean.status = UP;
                            bean.msg = `${responseData}, keyword [${this.keyword}] ${keywordFound ? "is" : "not"} found`;
                        } else {
                            log.debug("monitor:", `GRPC response [${response.data}] + ", but keyword [${this.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${response.data} + "]"`);
                            bean.status = DOWN;
                            bean.msg = `, but keyword [${this.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${responseData} + "]`;
                        }
                    }
                } else if (this.type === "postgres") {
                    let startTime = dayjs().valueOf();

                    await postgresQuery(this.databaseConnectionString, this.databaseQuery || "SELECT 1");

                    bean.msg = "";
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type === "mysql") {
                    let startTime = dayjs().valueOf();

                    // Use `radius_password` as `password` field, since there are too many unnecessary fields
                    // TODO: rename `radius_password` to `password` later for general use
                    let mysqlPassword = this.radiusPassword;

                    bean.msg = await mysqlQuery(this.databaseConnectionString, this.databaseQuery || "SELECT 1", mysqlPassword);
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type === "radius") {
                    let startTime = dayjs().valueOf();

                    // Handle monitors that were created before the
                    // update and as such don't have a value for
                    // this.port.
                    let port;
                    if (this.port == null) {
                        port = 1812;
                    } else {
                        port = this.port;
                    }

                    const resp = await radius(
                        this.hostname,
                        this.radiusUsername,
                        this.radiusPassword,
                        this.radiusCalledStationId,
                        this.radiusCallingStationId,
                        this.radiusSecret,
                        port,
                        this.interval * 1000 * 0.4,
                    );

                    bean.msg = resp.code;
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type === "redis") {
                    let startTime = dayjs().valueOf();

                    bean.msg = await redisPingAsync(this.databaseConnectionString, !this.ignoreTls);
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;

                } else if (this.type in UptimeKumaServer.monitorTypeList) {
                    let startTime = dayjs().valueOf();
                    const monitorType = UptimeKumaServer.monitorTypeList[this.type];
                    await monitorType.check(this, bean, UptimeKumaServer.getInstance());
                    if (!bean.ping) {
                        bean.ping = dayjs().valueOf() - startTime;
                    }

                } else if (this.type === "kafka-producer") {
                    let startTime = dayjs().valueOf();

                    bean.msg = await kafkaProducerAsync(
                        JSON.parse(this.kafkaProducerBrokers),
                        this.kafkaProducerTopic,
                        this.kafkaProducerMessage,
                        {
                            allowAutoTopicCreation: this.kafkaProducerAllowAutoTopicCreation,
                            ssl: this.kafkaProducerSsl,
                            clientId: `Uptime-Kuma/${version}`,
                            interval: this.interval,
                        },
                        JSON.parse(this.kafkaProducerSaslOptions),
                    );
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;

                } else {
                    throw new Error("Unknown Monitor Type");
                }

                if (this.isUpsideDown()) {
                    bean.status = flipStatus(bean.status);

                    if (bean.status === DOWN) {
                        throw new Error("Flip UP to DOWN");
                    }
                }

                retries = 0;

            } catch (error) {

                if (error?.name === "CanceledError") {
                    bean.msg = `timeout by AbortSignal (${this.timeout}s)`;
                } else {
                    bean.msg = error.message;
                }

                // If UP come in here, it must be upside down mode
                // Just reset the retries
                if (this.isUpsideDown() && bean.status === UP) {
                    retries = 0;

                } else if ((this.maxretries > 0) && (retries < this.maxretries)) {
                    retries++;
                    bean.status = PENDING;
                } else {
                    // Continue counting retries during DOWN
                    retries++;
                }
            }

            bean.retries = retries;

            log.debug("monitor", `[${this.name}] Check isImportant`);
            let isImportant = Monitor.isImportantBeat(isFirstBeat, previousBeat?.status, bean.status);

            // Mark as important if status changed, ignore pending pings,
            // Don't notify if disrupted changes to up
            if (isImportant) {
                bean.important = true;

                if (Monitor.isImportantForNotification(isFirstBeat, previousBeat?.status, bean.status)) {
                    log.debug("monitor", `[${this.name}] sendNotification`);
                    await Monitor.sendNotification(isFirstBeat, this, bean);
                } else {
                    log.debug("monitor", `[${this.name}] will not sendNotification because it is (or was) under maintenance`);
                }

                // Reset down count
                bean.downCount = 0;

                // Clear Status Page Cache
                log.debug("monitor", `[${this.name}] apicache clear`);
                apicache.clear();

                await UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);

            } else {
                bean.important = false;

                if (bean.status === DOWN && this.resendInterval > 0) {
                    ++bean.downCount;
                    if (bean.downCount >= this.resendInterval) {
                        // Send notification again, because we are still DOWN
                        log.debug("monitor", `[${this.name}] sendNotification again: Down Count: ${bean.downCount} | Resend Interval: ${this.resendInterval}`);
                        await Monitor.sendNotification(isFirstBeat, this, bean);

                        // Reset down count
                        bean.downCount = 0;
                    }
                }
            }

            if (bean.status === UP) {
                log.debug("monitor", `Monitor #${this.id} '${this.name}': Successful Response: ${bean.ping} ms | Interval: ${beatInterval} seconds | Type: ${this.type}`);
            } else if (bean.status === PENDING) {
                if (this.retryInterval > 0) {
                    beatInterval = this.retryInterval;
                }
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Pending: ${bean.msg} | Max retries: ${this.maxretries} | Retry: ${retries} | Retry Interval: ${beatInterval} seconds | Type: ${this.type}`);
            } else if (bean.status === MAINTENANCE) {
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Under Maintenance | Type: ${this.type}`);
            } else {
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Failing: ${bean.msg} | Interval: ${beatInterval} seconds | Type: ${this.type} | Down Count: ${bean.downCount} | Resend Interval: ${this.resendInterval}`);
            }

            // Calculate uptime
            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(this.id);
            let endTimeDayjs = await uptimeCalculator.update(bean.status, parseFloat(bean.ping));
            bean.end_time = R.isoDateTimeMillis(endTimeDayjs);

            // Send to frontend
            log.debug("monitor", `[${this.name}] Send to socket`);
            io.to(this.user_id).emit("heartbeat", bean.toJSON());
            Monitor.sendStats(io, this.id, this.user_id);

            // Store to database
            log.debug("monitor", `[${this.name}] Store`);
            await R.store(bean);

            log.debug("monitor", `[${this.name}] prometheus.update`);
            this.prometheus?.update(bean, tlsInfo);

            previousBeat = bean;

            if (! this.isStop) {
                log.debug("monitor", `[${this.name}] SetTimeout for next check.`);

                let intervalRemainingMs = Math.max(
                    1,
                    beatInterval * 1000 - dayjs().diff(dayjs.utc(bean.time))
                );

                log.debug("monitor", `[${this.name}] Next heartbeat in: ${intervalRemainingMs}ms`);

                this.heartbeatInterval = setTimeout(safeBeat, intervalRemainingMs);
            } else {
                log.info("monitor", `[${this.name}] isStop = true, no next check.`);
            }

        };

        /**
         * Get a heartbeat and handle errors7
         * @returns {void}
         */
        const safeBeat = async () => {
            try {
                await beat();
            } catch (e) {
                console.trace(e);
                UptimeKumaServer.errorLog(e, false);
                log.error("monitor", "Please report to https://github.com/louislam/uptime-kuma/issues");

                if (! this.isStop) {
                    log.info("monitor", "Try to restart the monitor");
                    this.heartbeatInterval = setTimeout(safeBeat, this.interval * 1000);
                }
            }
        };

        // Delay Push Type
        if (this.type === "push") {
            setTimeout(() => {
                safeBeat();
            }, this.interval * 1000);
        } else {
            safeBeat();
        }
    }

    /**
     * Make a request using axios
     * @param {object} options Options for Axios
     * @param {boolean} finalCall Should this be the final call i.e
     * don't retry on failure
     * @returns {object} Axios response
     */
    async makeAxiosRequest(options, finalCall = false) {
        try {
            let res;
            if (this.auth_method === "ntlm") {
                options.httpsAgent.keepAlive = true;

                res = await httpNtlm(options, {
                    username: this.basic_auth_user,
                    password: this.basic_auth_pass,
                    domain: this.authDomain,
                    workstation: this.authWorkstation ? this.authWorkstation : undefined
                });
            } else {
                res = await axios.request(options);
            }

            return res;
        } catch (error) {

            /**
             * Make a single attempt to obtain an new access token in the event that
             * the recent api request failed for authentication purposes
             */
            if (this.auth_method === "oauth2-cc" && error.response.status === 401 && !finalCall) {
                this.oauthAccessToken = await this.makeOidcTokenClientCredentialsRequest();
                let oauth2AuthHeader = {
                    "Authorization": this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                };
                options.headers = { ...(options.headers),
                    ...(oauth2AuthHeader)
                };

                return this.makeAxiosRequest(options, true);
            }

            // Fix #2253
            // Read more: https://stackoverflow.com/questions/1759956/curl-error-18-transfer-closed-with-outstanding-read-data-remaining
            if (!finalCall && typeof error.message === "string" && error.message.includes("maxContentLength size of -1 exceeded")) {
                log.debug("monitor", "makeAxiosRequest with gzip");
                options.headers["Accept-Encoding"] = "gzip, deflate";
                return this.makeAxiosRequest(options, true);
            } else {
                if (typeof error.message === "string" && error.message.includes("maxContentLength size of -1 exceeded")) {
                    error.message = "response timeout: incomplete response within a interval";
                }
                throw error;
            }
        }
    }

    /**
     * Stop monitor
     * @returns {Promise<void>}
     */
    async stop() {
        clearTimeout(this.heartbeatInterval);
        this.isStop = true;

        this.prometheus?.remove();
    }

    /**
     * Get prometheus instance
     * @returns {Prometheus|undefined} Current prometheus instance
     */
    getPrometheus() {
        return this.prometheus;
    }

    /**
     * Helper Method:
     * returns URL object for further usage
     * returns null if url is invalid
     * @returns {(null|URL)} Monitor URL
     */
    getUrl() {
        try {
            return new URL(this.url);
        } catch (_) {
            return null;
        }
    }

    /**
     * Example: http: or https:
     * @returns {(null|string)} URL's protocol
     */
    getURLProtocol() {
        const url = this.getUrl();
        if (url) {
            return this.getUrl().protocol;
        } else {
            return null;
        }
    }

    /**
     * Store TLS info to database
     * @param {object} checkCertificateResult Certificate to update
     * @returns {Promise<object>} Updated certificate
     */
    async updateTlsInfo(checkCertificateResult) {
        let tlsInfoBean = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            this.id,
        ]);

        if (tlsInfoBean == null) {
            tlsInfoBean = R.dispense("monitor_tls_info");
            tlsInfoBean.monitor_id = this.id;
        } else {

            // Clear sent history if the cert changed.
            try {
                let oldCertInfo = JSON.parse(tlsInfoBean.info_json);

                let isValidObjects = oldCertInfo && oldCertInfo.certInfo && checkCertificateResult && checkCertificateResult.certInfo;

                if (isValidObjects) {
                    if (oldCertInfo.certInfo.fingerprint256 !== checkCertificateResult.certInfo.fingerprint256) {
                        log.debug("monitor", "Resetting sent_history");
                        await R.exec("DELETE FROM notification_sent_history WHERE type = 'certificate' AND monitor_id = ?", [
                            this.id
                        ]);
                    } else {
                        log.debug("monitor", "No need to reset sent_history");
                        log.debug("monitor", oldCertInfo.certInfo.fingerprint256);
                        log.debug("monitor", checkCertificateResult.certInfo.fingerprint256);
                    }
                } else {
                    log.debug("monitor", "Not valid object");
                }
            } catch (e) { }

        }

        tlsInfoBean.info_json = JSON.stringify(checkCertificateResult);
        await R.store(tlsInfoBean);

        return checkCertificateResult;
    }

    /**
     * Checks if the monitor is active based on itself and its parents
     * @param {number} monitorID ID of monitor to send
     * @param {boolean} active is active
     * @returns {Promise<boolean>} Is the monitor active?
     */
    static async isActive(monitorID, active) {
        const parentActive = await Monitor.isParentActive(monitorID);

        return (active === 1) && parentActive;
    }

    /**
     * Send statistics to clients
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendStats(io, monitorID, userID) {
        const hasClients = getTotalClientInRoom(io, userID) > 0;
        let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(monitorID);

        if (hasClients) {
            // Send 24 hour average ping
            let data24h = await uptimeCalculator.get24Hour();
            io.to(userID).emit("avgPing", monitorID, (data24h.avgPing) ? Number(data24h.avgPing.toFixed(2)) : null);

            // Send 24 hour uptime
            io.to(userID).emit("uptime", monitorID, 24, data24h.uptime);

            // Send 30 day uptime
            let data30d = await uptimeCalculator.get30Day();
            io.to(userID).emit("uptime", monitorID, 720, data30d.uptime);

            // Send 1-year uptime
            let data1y = await uptimeCalculator.get1Year();
            io.to(userID).emit("uptime", monitorID, "1y", data1y.uptime);

            // Send Cert Info
            await Monitor.sendCertInfo(io, monitorID, userID);
        } else {
            log.debug("monitor", "No clients in the room, no need to send stats");
        }
    }

    /**
     * Send certificate information to client
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendCertInfo(io, monitorID, userID) {
        let tlsInfo = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            monitorID,
        ]);
        if (tlsInfo != null) {
            io.to(userID).emit("certInfo", monitorID, tlsInfo.info_json);
        }
    }

    /**
     * Has status of monitor changed since last beat?
     * @param {boolean} isFirstBeat Is this the first beat of this monitor?
     * @param {const} previousBeatStatus Status of the previous beat
     * @param {const} currentBeatStatus Status of the current beat
     * @returns {boolean} True if is an important beat else false
     */
    static isImportantBeat(isFirstBeat, previousBeatStatus, currentBeatStatus) {
        // * ? -> ANY STATUS = important [isFirstBeat]
        // UP -> PENDING = not important
        // * UP -> DOWN = important
        // UP -> UP = not important
        // PENDING -> PENDING = not important
        // * PENDING -> DOWN = important
        // PENDING -> UP = not important
        // DOWN -> PENDING = this case not exists
        // DOWN -> DOWN = not important
        // * DOWN -> UP = important
        // MAINTENANCE -> MAINTENANCE = not important
        // * MAINTENANCE -> UP = important
        // * MAINTENANCE -> DOWN = important
        // * DOWN -> MAINTENANCE = important
        // * UP -> MAINTENANCE = important
        return isFirstBeat ||
            (previousBeatStatus === DOWN && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === UP && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === UP) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN);
    }

    /**
     * Is this beat important for notifications?
     * @param {boolean} isFirstBeat Is this the first beat of this monitor?
     * @param {const} previousBeatStatus Status of the previous beat
     * @param {const} currentBeatStatus Status of the current beat
     * @returns {boolean} True if is an important beat else false
     */
    static isImportantForNotification(isFirstBeat, previousBeatStatus, currentBeatStatus) {
        // * ? -> ANY STATUS = important [isFirstBeat]
        // UP -> PENDING = not important
        // * UP -> DOWN = important
        // UP -> UP = not important
        // PENDING -> PENDING = not important
        // * PENDING -> DOWN = important
        // PENDING -> UP = not important
        // DOWN -> PENDING = this case not exists
        // DOWN -> DOWN = not important
        // * DOWN -> UP = important
        // MAINTENANCE -> MAINTENANCE = not important
        // MAINTENANCE -> UP = not important
        // * MAINTENANCE -> DOWN = important
        // DOWN -> MAINTENANCE = not important
        // UP -> MAINTENANCE = not important
        return isFirstBeat ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN);
    }

    /**
     * Send a notification about a monitor
     * @param {boolean} isFirstBeat Is this beat the first of this monitor?
     * @param {Monitor} monitor The monitor to send a notification about
     * @param {Bean} bean Status information about monitor
     * @returns {void}
     */
    static async sendNotification(isFirstBeat, monitor, bean) {
        if (!isFirstBeat || bean.status === DOWN) {
            const notificationList = await Monitor.getNotificationList(monitor);

            let text;
            if (bean.status === UP) {
                text = "✅ Up";
            } else {
                text = "🔴 Down";
            }

            let msg = `[${monitor.name}] [${text}] ${bean.msg}`;

            for (let notification of notificationList) {
                try {
                    const heartbeatJSON = bean.toJSON();
                    const monitorData = [{ id: monitor.id,
                        active: monitor.active,
                        name: monitor.name
                    }];
                    const preloadData = await Monitor.preparePreloadData(monitorData);
                    // Prevent if the msg is undefined, notifications such as Discord cannot send out.
                    if (!heartbeatJSON["msg"]) {
                        heartbeatJSON["msg"] = "N/A";
                    }

                    // Also provide the time in server timezone
                    heartbeatJSON["timezone"] = await UptimeKumaServer.getInstance().getTimezone();
                    heartbeatJSON["timezoneOffset"] = UptimeKumaServer.getInstance().getTimezoneOffset();
                    heartbeatJSON["localDateTime"] = dayjs.utc(heartbeatJSON["time"]).tz(heartbeatJSON["timezone"]).format(SQL_DATETIME_FORMAT);

                    await Notification.send(JSON.parse(notification.config), msg, monitor.toJSON(preloadData, false), heartbeatJSON);
                } catch (e) {
                    log.error("monitor", "Cannot send notification to " + notification.name);
                    log.error("monitor", e);
                }
            }
        }
    }

    /**
     * Get list of notification providers for a given monitor
     * @param {Monitor} monitor Monitor to get notification providers for
     * @returns {Promise<LooseObject<any>[]>} List of notifications
     */
    static async getNotificationList(monitor) {
        let notificationList = await R.getAll("SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id ", [
            monitor.id,
        ]);
        return notificationList;
    }

    /**
     * checks certificate chain for expiring certificates
     * @param {object} tlsInfoObject Information about certificate
     * @returns {void}
     */
    async checkCertExpiryNotifications(tlsInfoObject) {
        if (tlsInfoObject && tlsInfoObject.certInfo && tlsInfoObject.certInfo.daysRemaining) {
            const notificationList = await Monitor.getNotificationList(this);

            if (! notificationList.length > 0) {
                // fail fast. If no notification is set, all the following checks can be skipped.
                log.debug("monitor", "No notification, no need to send cert notification");
                return;
            }

            let notifyDays = await setting("tlsExpiryNotifyDays");
            if (notifyDays == null || !Array.isArray(notifyDays)) {
                // Reset Default
                await setSetting("tlsExpiryNotifyDays", [ 7, 14, 21 ], "general");
                notifyDays = [ 7, 14, 21 ];
            }

            if (Array.isArray(notifyDays)) {
                for (const targetDays of notifyDays) {
                    let certInfo = tlsInfoObject.certInfo;
                    while (certInfo) {
                        let subjectCN = certInfo.subject["CN"];
                        if (rootCertificates.has(certInfo.fingerprint256)) {
                            log.debug("monitor", `Known root cert: ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`);
                            break;
                        } else if (certInfo.daysRemaining > targetDays) {
                            log.debug("monitor", `No need to send cert notification for ${certInfo.certType} certificate "${subjectCN}" (${certInfo.daysRemaining} days valid) on ${targetDays} deadline.`);
                        } else {
                            log.debug("monitor", `call sendCertNotificationByTargetDays for ${targetDays} deadline on certificate ${subjectCN}.`);
                            await this.sendCertNotificationByTargetDays(subjectCN, certInfo.certType, certInfo.daysRemaining, targetDays, notificationList);
                        }
                        certInfo = certInfo.issuerCertificate;
                    }
                }
            }
        }
    }

    /**
     * Send a certificate notification when certificate expires in less
     * than target days
     * @param {string} certCN  Common Name attribute from the certificate subject
     * @param {string} certType  certificate type
     * @param {number} daysRemaining Number of days remaining on certificate
     * @param {number} targetDays Number of days to alert after
     * @param {LooseObject<any>[]} notificationList List of notification providers
     * @returns {Promise<void>}
     */
    async sendCertNotificationByTargetDays(certCN, certType, daysRemaining, targetDays, notificationList) {

        let row = await R.getRow("SELECT * FROM notification_sent_history WHERE type = ? AND monitor_id = ? AND days <= ?", [
            "certificate",
            this.id,
            targetDays,
        ]);

        // Sent already, no need to send again
        if (row) {
            log.debug("monitor", "Sent already, no need to send again");
            return;
        }

        let sent = false;
        log.debug("monitor", "Send certificate notification");

        for (let notification of notificationList) {
            try {
                log.debug("monitor", "Sending to " + notification.name);
                await Notification.send(JSON.parse(notification.config), `[${this.name}][${this.url}] ${certType} certificate ${certCN} will expire in ${daysRemaining} days`);
                sent = true;
            } catch (e) {
                log.error("monitor", "Cannot send cert notification to " + notification.name);
                log.error("monitor", e);
            }
        }

        if (sent) {
            await R.exec("INSERT INTO notification_sent_history (type, monitor_id, days) VALUES(?, ?, ?)", [
                "certificate",
                this.id,
                targetDays,
            ]);
        }
    }

    /**
     * Get the status of the previous heartbeat
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<LooseObject<any>>} Previous heartbeat
     */
    static async getPreviousHeartbeat(monitorID) {
        return await R.findOne("heartbeat", " id = (select MAX(id) from heartbeat where monitor_id = ?)", [
            monitorID
        ]);
    }

    /**
     * Check if monitor is under maintenance
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<boolean>} Is the monitor under maintenance
     */
    static async isUnderMaintenance(monitorID) {
        const maintenanceIDList = await R.getCol(`
            SELECT maintenance_id FROM monitor_maintenance
            WHERE monitor_id = ?
        `, [ monitorID ]);

        for (const maintenanceID of maintenanceIDList) {
            const maintenance = await UptimeKumaServer.getInstance().getMaintenance(maintenanceID);
            if (maintenance && await maintenance.isUnderMaintenance()) {
                return true;
            }
        }

        const parent = await Monitor.getParent(monitorID);
        if (parent != null) {
            return await Monitor.isUnderMaintenance(parent.id);
        }

        return false;
    }

    /**
     * Make sure monitor interval is between bounds
     * @returns {void}
     * @throws Interval is outside of range
     */
    validate() {
        if (this.interval > MAX_INTERVAL_SECOND) {
            throw new Error(`Interval cannot be more than ${MAX_INTERVAL_SECOND} seconds`);
        }
        if (this.interval < MIN_INTERVAL_SECOND) {
            throw new Error(`Interval cannot be less than ${MIN_INTERVAL_SECOND} seconds`);
        }

        if (this.type === "ping") {
            // ping parameters validation
            if (this.packetSize && (this.packetSize < PING_PACKET_SIZE_MIN || this.packetSize > PING_PACKET_SIZE_MAX)) {
                throw new Error(`Packet size must be between ${PING_PACKET_SIZE_MIN} and ${PING_PACKET_SIZE_MAX} (default: ${PING_PACKET_SIZE_DEFAULT})`);
            }

            if (this.ping_per_request_timeout && (this.ping_per_request_timeout < PING_PER_REQUEST_TIMEOUT_MIN || this.ping_per_request_timeout > PING_PER_REQUEST_TIMEOUT_MAX)) {
                throw new Error(`Per-ping timeout must be between ${PING_PER_REQUEST_TIMEOUT_MIN} and ${PING_PER_REQUEST_TIMEOUT_MAX} seconds (default: ${PING_PER_REQUEST_TIMEOUT_DEFAULT})`);
            }

            if (this.ping_count && (this.ping_count < PING_COUNT_MIN || this.ping_count > PING_COUNT_MAX)) {
                throw new Error(`Echo requests count must be between ${PING_COUNT_MIN} and ${PING_COUNT_MAX} (default: ${PING_COUNT_DEFAULT})`);
            }

            if (this.timeout) {
                const pingGlobalTimeout = Math.round(Number(this.timeout));

                if (pingGlobalTimeout < this.ping_per_request_timeout || pingGlobalTimeout < PING_GLOBAL_TIMEOUT_MIN || pingGlobalTimeout > PING_GLOBAL_TIMEOUT_MAX) {
                    throw new Error(`Timeout must be between ${PING_GLOBAL_TIMEOUT_MIN} and ${PING_GLOBAL_TIMEOUT_MAX} seconds (default: ${PING_GLOBAL_TIMEOUT_DEFAULT})`);
                }

                this.timeout = pingGlobalTimeout;
            }
        }
    }

    /**
     * Gets monitor notification of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorNotification(monitorIDs) {
        return await R.getAll(`
            SELECT monitor_notification.monitor_id, monitor_notification.notification_id
            FROM monitor_notification
            WHERE monitor_notification.monitor_id IN (${monitorIDs.map((_) => "?").join(",")})
        `, monitorIDs);
    }

    /**
     * Gets monitor tags of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorTag(monitorIDs) {
        return await R.getAll(`
            SELECT monitor_tag.monitor_id, monitor_tag.tag_id, monitor_tag.value, tag.name, tag.color
            FROM monitor_tag
            JOIN tag ON monitor_tag.tag_id = tag.id
            WHERE monitor_tag.monitor_id IN (${monitorIDs.map((_) => "?").join(",")})
        `, monitorIDs);
    }

    /**
     * prepare preloaded data for efficient access
     * @param {Array} monitorData IDs & active field of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async preparePreloadData(monitorData) {

        const notificationsMap = new Map();
        const tagsMap = new Map();
        const maintenanceStatusMap = new Map();
        const childrenIDsMap = new Map();
        const activeStatusMap = new Map();
        const forceInactiveMap = new Map();
        const pathsMap = new Map();

        if (monitorData.length > 0) {
            const monitorIDs = monitorData.map(monitor => monitor.id);
            const notifications = await Monitor.getMonitorNotification(monitorIDs);
            const tags = await Monitor.getMonitorTag(monitorIDs);
            const maintenanceStatuses = await Promise.all(monitorData.map(monitor => Monitor.isUnderMaintenance(monitor.id)));
            const childrenIDs = await Promise.all(monitorData.map(monitor => Monitor.getAllChildrenIDs(monitor.id)));
            const activeStatuses = await Promise.all(monitorData.map(monitor => Monitor.isActive(monitor.id, monitor.active)));
            const forceInactiveStatuses = await Promise.all(monitorData.map(monitor => Monitor.isParentActive(monitor.id)));
            const paths = await Promise.all(monitorData.map(monitor => Monitor.getAllPath(monitor.id, monitor.name)));

            notifications.forEach(row => {
                if (!notificationsMap.has(row.monitor_id)) {
                    notificationsMap.set(row.monitor_id, {});
                }
                notificationsMap.get(row.monitor_id)[row.notification_id] = true;
            });

            tags.forEach(row => {
                if (!tagsMap.has(row.monitor_id)) {
                    tagsMap.set(row.monitor_id, []);
                }
                tagsMap.get(row.monitor_id).push({
                    tag_id: row.tag_id,
                    monitor_id: row.monitor_id,
                    value: row.value,
                    name: row.name,
                    color: row.color
                });
            });

            monitorData.forEach((monitor, index) => {
                maintenanceStatusMap.set(monitor.id, maintenanceStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                childrenIDsMap.set(monitor.id, childrenIDs[index]);
            });

            monitorData.forEach((monitor, index) => {
                activeStatusMap.set(monitor.id, activeStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                forceInactiveMap.set(monitor.id, !forceInactiveStatuses[index]);
            });

            monitorData.forEach((monitor, index) => {
                pathsMap.set(monitor.id, paths[index]);
            });
        }

        return {
            notifications: notificationsMap,
            tags: tagsMap,
            maintenanceStatus: maintenanceStatusMap,
            childrenIDs: childrenIDsMap,
            activeStatus: activeStatusMap,
            forceInactive: forceInactiveMap,
            paths: pathsMap,
        };
    }

    /**
     * Gets Parent of the monitor
     * @param {number} monitorID ID of monitor to get
     * @returns {Promise<LooseObject<any>>} Parent
     */
    static async getParent(monitorID) {
        return await R.getRow(`
            SELECT parent.* FROM monitor parent
    		LEFT JOIN monitor child
    			ON child.parent = parent.id
            WHERE child.id = ?
        `, [
            monitorID,
        ]);
    }

    /**
     * Gets all Children of the monitor
     * @param {number} monitorID ID of monitor to get
     * @returns {Promise<LooseObject<any>[]>} Children
     */
    static async getChildren(monitorID) {
        return await R.getAll(`
            SELECT * FROM monitor
            WHERE parent = ?
        `, [
            monitorID,
        ]);
    }

    /**
     * Gets the full path
     * @param {number} monitorID ID of the monitor to get
     * @param {string} name of the monitor to get
     * @returns {Promise<string[]>} Full path (includes groups and the name) of the monitor
     */
    static async getAllPath(monitorID, name) {
        const path = [ name ];

        if (this.parent === null) {
            return path;
        }

        let parent = await Monitor.getParent(monitorID);
        while (parent !== null) {
            path.unshift(parent.name);
            parent = await Monitor.getParent(parent.id);
        }

        return path;
    }

    /**
     * Gets recursive all child ids
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<Array>} IDs of all children
     */
    static async getAllChildrenIDs(monitorID) {
        const childs = await Monitor.getChildren(monitorID);

        if (childs === null) {
            return [];
        }

        let childrenIDs = [];

        for (const child of childs) {
            childrenIDs.push(child.id);
            childrenIDs = childrenIDs.concat(await Monitor.getAllChildrenIDs(child.id));
        }

        return childrenIDs;
    }

    /**
     * Unlinks all children of the group monitor
     * @param {number} groupID ID of group to remove children of
     * @returns {Promise<void>}
     */
    static async unlinkAllChildren(groupID) {
        return await R.exec("UPDATE `monitor` SET parent = ? WHERE parent = ? ", [
            null, groupID
        ]);
    }

    /**
     * Checks recursive if parent (ancestors) are active
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<boolean>} Is the parent monitor active?
     */
    static async isParentActive(monitorID) {
        const parent = await Monitor.getParent(monitorID);

        if (parent === null) {
            return true;
        }

        const parentActive = await Monitor.isParentActive(parent.id);
        return parent.active && parentActive;
    }

    /**
     * Obtains a new Oidc Token
     * @returns {Promise<object>} OAuthProvider client
     */
    async makeOidcTokenClientCredentialsRequest() {
        log.debug("monitor", `[${this.name}] The oauth access-token undefined or expired. Requesting a new token`);
        const oAuthAccessToken = await getOidcTokenClientCredentials(this.oauth_token_url, this.oauth_client_id, this.oauth_client_secret, this.oauth_scopes, this.oauth_audience, this.oauth_auth_method);
        if (this.oauthAccessToken?.expires_at) {
            log.debug("monitor", `[${this.name}] Obtained oauth access-token. Expires at ${new Date(this.oauthAccessToken?.expires_at * 1000)}`);
        } else {
            log.debug("monitor", `[${this.name}] Obtained oauth access-token. Time until expiry was not provided`);
        }

        return oAuthAccessToken;
    }

    /**
     * Store TLS certificate information and check for expiry
     * @param {object} tlsInfo Information about the TLS connection
     * @returns {Promise<void>}
     */
    async handleTlsInfo(tlsInfo) {
        await this.updateTlsInfo(tlsInfo);
        this.prometheus?.update(null, tlsInfo);

        if (!this.getIgnoreTls() && this.isEnabledExpiryNotification()) {
            log.debug("monitor", `[${this.name}] call checkCertExpiryNotifications`);
            await this.checkCertExpiryNotifications(tlsInfo);
        }
    }
}

module.exports = Monitor;
