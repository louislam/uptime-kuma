const dayjs = require("dayjs");
const axios = require("axios");
const { Prometheus } = require("../prometheus");
const {
    log,
    UP,
    DOWN,
    PENDING,
    MAINTENANCE,
    flipStatus,
    MAX_INTERVAL_SECOND,
    MIN_INTERVAL_SECOND,
    SQL_DATETIME_FORMAT,
    evaluateJsonQuery,
    PING_PACKET_SIZE_MIN,
    PING_PACKET_SIZE_MAX,
    PING_PACKET_SIZE_DEFAULT,
    PING_GLOBAL_TIMEOUT_MIN,
    PING_GLOBAL_TIMEOUT_MAX,
    PING_GLOBAL_TIMEOUT_DEFAULT,
    PING_COUNT_MIN,
    PING_COUNT_MAX,
    PING_COUNT_DEFAULT,
    PING_PER_REQUEST_TIMEOUT_MIN,
    PING_PER_REQUEST_TIMEOUT_MAX,
    PING_PER_REQUEST_TIMEOUT_DEFAULT,
    RESPONSE_BODY_LENGTH_DEFAULT,
    RESPONSE_BODY_LENGTH_MAX,
} = require("../../src/util");
const {
    ping,
    checkCertificate,
    checkStatusCode,
    getTotalClientInRoom,
    setting,
    httpNtlm,
    radius,
    kafkaProducerAsync,
    getOidcTokenClientCredentials,
    rootCertificatesFingerprints,
    axiosAbortSignal,
    checkCertificateHostname,
    encodeBase64,
    checkCertExpiryNotifications,
} = require("../util-server");
const { getKnex } = require("../db");
const { normalizeRows } = require("../utils/db-result");
const { isoDateTimeMillis } = require("../utils/iso-datetime");
const { safeJsonParse } = require("../utils/safe-json");
const { BaseModel } = require("./base-model");
const Heartbeat = require("./heartbeat");
const ProxyModel = require("./proxy");
const DockerHostModel = require("./docker_host");
const { Notification } = require("../notification");
const { Proxy } = require("../proxy");
const { demoMode } = require("../config");
const version = require("../../package.json").version;
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { DockerHost } = require("../docker");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { UptimeCalculator } = require("../uptime-calculator");
const { CookieJar } = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const https = require("https");
const http = require("http");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const brotliCompress = promisify(zlib.brotliCompress);
const DomainExpiry = require("./domain_expiry");

const rootCertificates = rootCertificatesFingerprints();

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 *      3 = MAINTENANCE
 */
class Monitor extends BaseModel {
    static tableName = "monitor";

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
            sendUrl: this.send_url,
            type: this.type,
        };

        if (this.send_url) {
            obj.url = this.custom_url ?? this.url;
        }

        if (showTags) {
            obj.tags = await this.getTags();
        }

        if (certExpiry) {
            const { certExpiryDaysRemaining, validCert } = await this.getCertExpiry(this.id);
            obj.certExpiryDaysRemaining = certExpiryDaysRemaining;
            obj.validCert = validCert;
        }

        return obj;
    }

    /**
     * Lazily compute and cache the signed screenshot path. Signing a
     * JWT per toJSON() call is expensive when emitting hundreds or
     * thousands of monitors at once (M-6 in docs/ARCHITECTURE_REVIEW.md).
     * The JWT secret is read once at server start and is treated as
     * stable for the process lifetime; rotating the secret already
     * requires a server restart.
     * @returns {string} Signed screenshot URL path
     */
    get _signedScreenshotPath() {
        if (!this.__cachedScreenshotPath) {
            const secret = UptimeKumaServer.getInstance().jwtSecret;
            this.__cachedScreenshotPath = "/screenshots/" + jwt.sign(this.id, secret) + ".png";
        }
        return this.__cachedScreenshotPath;
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
            screenshot = this._signedScreenshotPath;
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
            wsIgnoreSecWebsocketAcceptHeader: this.getWsIgnoreSecWebsocketAcceptHeader(),
            wsSubprotocol: this.ws_subprotocol,
            method: this.method,
            hostname: this.hostname,
            port: this.port,
            location: this.location,
            protocol: this.protocol,
            maxretries: this.maxretries,
            weight: this.weight,
            active: preloadData.activeStatus.get(this.id),
            forceInactive: preloadData.forceInactive.get(this.id),
            type: this.type,
            subtype: this.subtype,
            timeout: this.timeout,
            interval: this.interval,
            retryInterval: this.retry_interval,
            retryOnlyOnStatusCodeFailure: Boolean(this.retry_only_on_status_code_failure),
            resendInterval: this.resend_interval,
            keyword: this.keyword,
            invertKeyword: this.isInvertKeyword(),
            expiryNotification: this.isEnabledExpiryNotification(),
            domainExpiryNotification: Boolean(this.domain_expiry_notification),
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            packetSize: this.packet_size,
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
            mqttTopic: this.mqtt_topic,
            mqttSuccessMessage: this.mqtt_success_message,
            mqttCheckType: this.mqtt_check_type,
            databaseQuery: this.database_query,
            authMethod: this.auth_method,
            grpcUrl: this.grpc_url,
            grpcProtobuf: this.grpc_protobuf,
            grpcMethod: this.grpc_method,
            grpcServiceName: this.grpc_service_name,
            grpcEnableTls: this.getGrpcEnableTls(),
            radiusCalledStationId: this.radius_called_station_id,
            radiusCallingStationId: this.radius_calling_station_id,
            game: this.game,
            gamedigGivenPortOnly: this.getGameDigGivenPortOnly(),
            httpBodyEncoding: this.http_body_encoding,
            jsonPath: this.json_path,
            expectedValue: this.expected_value,
            system_service_name: this.system_service_name,
            kafkaProducerTopic: this.kafka_producer_topic,
            kafkaProducerBrokers: safeJsonParse(this.kafka_producer_brokers, [], "kafka_producer_brokers"),
            kafkaProducerSsl: this.getKafkaProducerSsl(),
            kafkaProducerAllowAutoTopicCreation: this.getKafkaProducerAllowAutoTopicCreation(),
            kafkaProducerMessage: this.kafka_producer_message,
            screenshot,
            cacheBust: this.getCacheBust(),
            remote_browser: this.remote_browser,
            snmpOid: this.snmp_oid,
            jsonPathOperator: this.json_path_operator,
            snmpVersion: this.snmp_version,
            smtpSecurity: this.smtp_security,
            rabbitmqNodes: safeJsonParse(this.rabbitmq_nodes, [], "rabbitmq_nodes"),
            conditions: safeJsonParse(this.conditions, [], "conditions"),
            ipFamily: this.ip_family,
            expectedTlsAlert: this.expected_tls_alert,

            // ping advanced options
            ping_numeric: this.isPingNumeric(),
            ping_count: this.ping_count,
            ping_per_request_timeout: this.ping_per_request_timeout,

            // response saving options
            saveResponse: this.getSaveResponse(),
            saveErrorResponse: this.getSaveErrorResponse(),
            responseMaxLength: this.response_max_length ?? RESPONSE_BODY_LENGTH_DEFAULT,
        };

        if (includeSensitiveData) {
            data = {
                ...data,
                headers: this.headers,
                body: this.body,
                grpcBody: this.grpc_body,
                grpcMetadata: this.grpc_metadata,
                basic_auth_user: this.basic_auth_user,
                basic_auth_pass: this.basic_auth_pass,
                oauth_client_id: this.oauth_client_id,
                oauth_client_secret: this.oauth_client_secret,
                oauth_token_url: this.oauth_token_url,
                oauth_scopes: this.oauth_scopes,
                oauth_audience: this.oauth_audience,
                oauth_auth_method: this.oauth_auth_method,
                pushToken: this.push_token,
                databaseConnectionString: this.database_connection_string,
                radiusUsername: this.radius_username,
                radiusPassword: this.radius_password,
                radiusSecret: this.radius_secret,
                mqttUsername: this.mqtt_username,
                mqttPassword: this.mqtt_password,
                mqttWebsocketPath: this.mqtt_websocket_path,
                authWorkstation: this.auth_workstation,
                authDomain: this.auth_domain,
                tlsCa: this.tls_ca,
                tlsCert: this.tls_cert,
                tlsKey: this.tls_key,
                kafkaProducerSaslOptions: safeJsonParse(this.kafka_producer_sasl_options, null, "kafka_producer_sasl_options"),
                rabbitmqUsername: this.rabbitmq_username,
                rabbitmqPassword: this.rabbitmq_password,
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
        const knex = getKnex();
        // portable SQL: standard SELECT/JOIN/WHERE/ORDER BY with a parameter
        // placeholder. SQLite, MariaDB and PostgreSQL all parse this identically.
        const result = await knex.raw(
            "SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ? ORDER BY tag.name",
            [this.id]
        );
        return normalizeRows(knex, result);
    }

    /**
     * Gets certificate expiry for this monitor
     * @param {number} monitorID ID of monitor to send
     * @returns {Promise<LooseObject<any>>} Certificate expiry info for
     * monitor
     */
    async getCertExpiry(monitorID) {
        let tlsInfoBean = await getKnex()("monitor_tls_info").where("monitor_id", monitorID).first();
        let tlsInfo;
        if (tlsInfoBean) {
            tlsInfo = JSON.parse(tlsInfoBean?.info_json);
            if (tlsInfo?.valid && tlsInfo?.certInfo?.daysRemaining) {
                return {
                    certExpiryDaysRemaining: tlsInfo.certInfo.daysRemaining,
                    validCert: true,
                };
            }
        }
        return {
            certExpiryDaysRemaining: "",
            validCert: false,
        };
    }

    /**
     * Is the TLS expiry notification enabled?
     * @returns {boolean} Enabled?
     */
    isEnabledExpiryNotification() {
        return Boolean(this.expiry_notification);
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
        return Boolean(this.ignore_tls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should WS headers be ignored?
     */
    getWsIgnoreSecWebsocketAcceptHeader() {
        return Boolean(this.ws_ignore_sec_websocket_accept_header);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Is the monitor in upside down mode?
     */
    isUpsideDown() {
        return Boolean(this.upside_down);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Invert keyword match?
     */
    isInvertKeyword() {
        return Boolean(this.invert_keyword);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Enable TLS for gRPC?
     */
    getGrpcEnableTls() {
        return Boolean(this.grpc_enable_tls);
    }

    /**
     * Parse to boolean
     * @returns {boolean} if cachebusting is enabled
     */
    getCacheBust() {
        return Boolean(this.cache_bust);
    }

    /**
     * Get accepted status codes
     * @returns {object} Accepted status codes
     */
    getAcceptedStatuscodes() {
        return safeJsonParse(this.accepted_statuscodes_json, [ "200" ], "accepted_statuscodes_json");
    }

    /**
     * Get if game dig should only use the port which was provided
     * @returns {boolean} gamedig should only use the provided port
     */
    getGameDigGivenPortOnly() {
        return Boolean(this.gamedig_given_port_only);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Ssl enabled?
     */
    getKafkaProducerSsl() {
        return Boolean(this.kafka_producer_ssl);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Kafka Producer Allow Auto Topic Creation Enabled?
     */
    getKafkaProducerAllowAutoTopicCreation() {
        return Boolean(this.kafka_producer_allow_auto_topic_creation);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should save response data on success?
     */
    getSaveResponse() {
        return Boolean(this.save_response);
    }

    /**
     * Parse to boolean
     * @returns {boolean} Should save response data on error?
     */
    getSaveErrorResponse() {
        return Boolean(this.save_error_response);
    }

    /**
     * Start monitor
     * @param {Server} io Socket server instance
     * @returns {Promise<void>}
     */
    async start(io) {
        let previousBeat = null;
        let retries = 0;

        this.rootCertificates = rootCertificates;

        // Pre-fetch static per-monitor config (proxy, docker host) so the
        // beat() closure does not requery these on every heartbeat. They
        // only change via editMonitor, which restarts the monitor and
        // re-runs this method. See H-3 in docs/ARCHITECTURE_REVIEW.md.
        await this._refreshStaticConfig();

        try {
            this.prometheus = new Prometheus(this, await this.getTags());
        } catch (e) {
            log.error("prometheus", "Please submit an issue to our GitHub repo. Prometheus update error: ", e.message);
        }

        const beat = async () => {
            let beatInterval = this.interval;

            if (!beatInterval) {
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
                previousBeat = await Heartbeat.query().where("monitor_id", this.id).orderBy("time", "desc").first();
                if (previousBeat) {
                    retries = previousBeat.retries;
                }
            }

            const isFirstBeat = !previousBeat;

            let bean = new Heartbeat();
            bean.monitor_id = this.id;
            bean.time = isoDateTimeMillis(dayjs.utc());
            bean.status = DOWN;
            bean.down_count = previousBeat?.down_count || 0;

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
                            Authorization: "Basic " + encodeBase64(this.basic_auth_user, this.basic_auth_pass),
                        };
                    }

                    // OIDC: Basic client credential flow.
                    // Additional grants might be implemented in the future
                    let oauth2AuthHeader = {};
                    if (this.auth_method === "oauth2-cc") {
                        try {
                            if (
                                this.oauthAccessToken === undefined ||
                                new Date(this.oauthAccessToken.expires_at * 1000) <= new Date()
                            ) {
                                this.oauthAccessToken = await this.makeOidcTokenClientCredentialsRequest();
                            }
                            oauth2AuthHeader = {
                                Authorization:
                                    this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                            };
                        } catch (e) {
                            throw new Error("The oauth config is invalid. " + e.message);
                        }
                    }

                    let agentFamily = undefined;
                    if (this.ip_family === "ipv4") {
                        agentFamily = 4;
                    }
                    if (this.ip_family === "ipv6") {
                        agentFamily = 6;
                    }

                    const httpsAgentOptions = {
                        maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                        rejectUnauthorized: !this.getIgnoreTls(),
                        secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {}),
                    };

                    const httpAgentOptions = {
                        maxCachedSessions: 0,
                        autoSelectFamily: true,
                        ...(agentFamily ? { family: agentFamily } : {}),
                    };

                    log.debug("monitor", `[${this.name}] Prepare Options for axios`);

                    let contentType = null;
                    let bodyValue = null;

                    if (this.body && typeof this.body === "string" && this.body.trim().length > 0) {
                        if (!this.http_body_encoding || this.http_body_encoding === "json") {
                            try {
                                bodyValue = JSON.parse(this.body);
                                contentType = "application/json";
                            } catch (e) {
                                throw new Error("Your JSON body is invalid. " + e.message);
                            }
                        } else if (this.http_body_encoding === "form") {
                            bodyValue = this.body;
                            contentType = "application/x-www-form-urlencoded";
                        } else if (this.http_body_encoding === "xml") {
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
                            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            ...(contentType ? { "Content-Type": contentType } : {}),
                            ...basicAuthHeader,
                            ...oauth2AuthHeader,
                            ...(this.headers ? JSON.parse(this.headers) : {}),
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

                    if (this.cache_bust) {
                        const randomFloatString = Math.random().toString(36);
                        const cacheBust = randomFloatString.substring(2);
                        options.params = {
                            uptime_kuma_cachebuster: cacheBust,
                        };
                    }

                    if (this.proxy_id) {
                        // Use the pre-fetched bean populated in start(); see
                        // _refreshStaticConfig().
                        const proxy = this._proxyBean;

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

                    if (this.auth_method === "mtls") {
                        if (this.tls_cert !== null && this.tls_cert !== "") {
                            options.httpsAgent.options.cert = Buffer.from(this.tls_cert);
                        }
                        if (this.tls_ca !== null && this.tls_ca !== "") {
                            options.httpsAgent.options.ca = Buffer.from(this.tls_ca);
                        }
                        if (this.tls_key !== null && this.tls_key !== "") {
                            options.httpsAgent.options.key = Buffer.from(this.tls_key);
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
                                this.getUrl()?.hostname
                            );

                            await this.handleTlsInfo(tlsInfo);
                        });
                    });

                    log.debug("monitor", `[${this.name}] Axios Options: ${JSON.stringify(options)}`);
                    log.debug("monitor", `[${this.name}] Axios Request`);

                    // Make Request
                    let res = await this.makeAxiosRequest(options);

                    bean.msg = `${res.status} - ${res.statusText}`;
                    bean.ping = dayjs().valueOf() - startTime;

                    // in the frontend, the save response is only shown if the saveErrorResponse is set
                    if (this.getSaveResponse() && this.getSaveErrorResponse()) {
                        await this.saveResponseData(bean, res.data);
                    }

                    // fallback for if kelog event is not emitted, but we may still have tlsInfo,
                    // e.g. if the connection is made through a proxy
                    if (this.getUrl()?.protocol === "https:" && tlsInfo.valid === undefined) {
                        const tlsSocket = res.request.res.socket;

                        if (tlsSocket) {
                            tlsInfo = checkCertificate(tlsSocket);
                            tlsInfo.valid = tlsSocket.authorized || false;
                            tlsInfo.hostnameMatchMonitorUrl = checkCertificateHostname(
                                tlsInfo.certInfo.raw,
                                this.getUrl()?.hostname
                            );

                            await this.handleTlsInfo(tlsInfo);
                        }
                    }

                    // eslint-disable-next-line eqeqeq
                    if (process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID == this.id) {
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
                            throw new Error(
                                bean.msg +
                                    ", but keyword is " +
                                    (keywordFound ? "present" : "not") +
                                    " in [" +
                                    data +
                                    "]"
                            );
                        }
                    } else if (this.type === "json-query") {
                        let data = res.data;

                        const { status, response } = await evaluateJsonQuery(
                            data,
                            this.json_path,
                            this.json_path_operator,
                            this.expected_value
                        );

                        if (status) {
                            bean.status = UP;
                            bean.msg = `JSON query passes (comparing ${response} ${this.json_path_operator} ${this.expected_value})`;
                        } else {
                            throw new Error(
                                `JSON query does not pass (comparing ${response} ${this.json_path_operator} ${this.expected_value})`
                            );
                        }
                    }
                } else if (this.type === "ping") {
                    bean.ping = await ping(
                        this.hostname,
                        this.ping_count,
                        "",
                        this.ping_numeric,
                        this.packet_size,
                        this.timeout,
                        this.ping_per_request_timeout
                    );
                    bean.msg = "";
                    bean.status = UP;
                } else if (this.type === "push") {
                    // Type: Push
                    log.debug(
                        "monitor",
                        `[${this.name}] Checking monitor at ${dayjs().format("YYYY-MM-DD HH:mm:ss.SSS")}`
                    );
                    const bufferTime = 1000; // 1s buffer to accommodate clock differences

                    if (previousBeat) {
                        const msSinceLastBeat = dayjs.utc().valueOf() - dayjs.utc(previousBeat.time).valueOf();

                        log.debug("monitor", `[${this.name}] msSinceLastBeat = ${msSinceLastBeat}`);

                        // If the previous beat was down or pending we use the regular
                        // beatInterval/retryInterval in the setTimeout further below
                        if (
                            previousBeat.status !== (this.isUpsideDown() ? DOWN : UP) ||
                            msSinceLastBeat > beatInterval * 1000 + bufferTime
                        ) {
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
                            Accept: "*/*",
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
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
                        },
                    });

                    if (res.data.response && res.data.response.servers && res.data.response.servers.length > 0) {
                        bean.status = UP;
                        bean.msg = res.data.response.servers[0].name;

                        try {
                            bean.ping = await ping(
                                this.hostname,
                                PING_COUNT_DEFAULT,
                                "",
                                true,
                                this.packet_size,
                                PING_GLOBAL_TIMEOUT_DEFAULT,
                                PING_PER_REQUEST_TIMEOUT_DEFAULT
                            );
                        } catch (_) {}
                    } else {
                        throw new Error("Server not found on Steam");
                    }
                } else if (this.type === "docker") {
                    log.debug("monitor", `[${this.name}] Prepare Options for Axios`);

                    const options = {
                        url: `/containers/${this.docker_container}/json`,
                        timeout: this.interval * 1000 * 0.8,
                        headers: {
                            Accept: "*/*",
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
                            secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
                        }),
                        httpAgent: new http.Agent({
                            maxCachedSessions: 0,
                        }),
                    };

                    // Use the pre-fetched bean populated in start(); see
                    // _refreshStaticConfig().
                    const dockerHost = this._dockerHostBean;

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

                    if (!res.data.State) {
                        throw Error("Container state is not available");
                    }
                    if (!res.data.State.Running) {
                        throw Error("Container State is " + res.data.State.Status);
                    }
                    if (res.data.State.Paused) {
                        throw Error("Container is in a paused state");
                    }
                    if (res.data.State.Restarting) {
                        bean.status = PENDING;
                        bean.msg = "Container is reporting it is currently restarting";
                    } else if (res.data.State.Health && res.data.State.Health.Status !== "none") {
                        // if healthchecks are disabled (?), Health MAY not be present
                        if (res.data.State.Health.Status === "healthy") {
                            bean.status = UP;
                            bean.msg = "healthy";
                        } else if (res.data.State.Health.Status === "unhealthy") {
                            throw Error("Container State is unhealthy according to its healthcheck");
                        } else {
                            bean.status = PENDING;
                            bean.msg = res.data.State.Health.Status;
                        }
                    } else {
                        bean.status = UP;
                        bean.msg = `Container has not reported health and is currently ${res.data.State.Status}. As it is running, it is considered UP. Consider adding a health check for better service visibility`;
                    }
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
                        this.radius_username,
                        this.radius_password,
                        this.radius_called_station_id,
                        this.radius_calling_station_id,
                        this.radius_secret,
                        port,
                        this.interval * 1000 * 0.4
                    );

                    bean.msg = resp.code;
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type in UptimeKumaServer.monitorTypeList) {
                    let startTime = dayjs().valueOf();
                    const monitorType = UptimeKumaServer.monitorTypeList[this.type];
                    await monitorType.check(this, bean, UptimeKumaServer.getInstance());

                    if (!monitorType.allowCustomStatus && bean.status !== UP) {
                        throw new Error(
                            "The monitor implementation is incorrect, non-UP error must throw error inside check()"
                        );
                    }

                    if (bean.ping === undefined || bean.ping === null) {
                        bean.ping = dayjs().valueOf() - startTime;
                    }
                } else if (this.type === "kafka-producer") {
                    let startTime = dayjs().valueOf();

                    bean.msg = await kafkaProducerAsync(
                        JSON.parse(this.kafka_producer_brokers),
                        this.kafka_producer_topic,
                        this.kafka_producer_message,
                        {
                            allowAutoTopicCreation: this.kafka_producer_allow_auto_topic_creation,
                            ssl: this.kafka_producer_ssl,
                            clientId: `Uptime-Kuma/${version}`,
                            interval: this.interval,
                        },
                        JSON.parse(this.kafka_producer_sasl_options)
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

                if (this.getSaveErrorResponse() && error?.response?.data !== undefined) {
                    await this.saveResponseData(bean, error.response.data);
                }

                // If UP come in here, it must be upside down mode
                // Just reset the retries
                if (this.isUpsideDown() && bean.status === UP) {
                    retries = 0;
                } else if (this.type === "json-query" && this.retry_only_on_status_code_failure) {
                    // For json-query monitors with retry_only_on_status_code_failure enabled,
                    // only retry if the error is NOT from JSON query evaluation
                    // JSON query errors have the message "JSON query does not pass..."
                    const isJsonQueryError =
                        typeof error.message === "string" && error.message.includes("JSON query does not pass");

                    if (isJsonQueryError) {
                        // Don't retry on JSON query failures, mark as DOWN immediately
                        retries = 0;
                    } else if (this.maxretries > 0 && retries < this.maxretries) {
                        retries++;
                        bean.status = PENDING;
                    } else {
                        // Continue counting retries during DOWN
                        retries++;
                    }
                } else {
                    // General retry logic for all other monitor types
                    if (this.maxretries > 0 && retries < this.maxretries) {
                        retries++;
                        bean.status = PENDING;
                    } else {
                        // Continue counting retries during DOWN
                        retries++;
                    }
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
                    log.debug(
                        "monitor",
                        `[${this.name}] will not sendNotification because it is (or was) under maintenance`
                    );
                }

                // Reset down count
                bean.down_count = 0;

                // Clear Status Page Cache
                log.debug("monitor", `[${this.name}] apicache clear`);
                apicache.clear();

                await UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);
            } else {
                bean.important = false;

                if (bean.status === DOWN && this.resend_interval > 0) {
                    ++bean.down_count;
                    if (bean.down_count >= this.resend_interval) {
                        // Send notification again, because we are still DOWN
                        log.debug(
                            "monitor",
                            `[${this.name}] sendNotification again: Down Count: ${bean.down_count} | Resend Interval: ${this.resend_interval}`
                        );
                        await Monitor.sendNotification(isFirstBeat, this, bean);

                        // Reset down count
                        bean.down_count = 0;
                    }
                }
            }

            if (bean.status !== MAINTENANCE && Boolean(this.domain_expiry_notification)) {
                try {
                    const supportInfo = await DomainExpiry.checkSupport(this);
                    const domainExpiryDate = await DomainExpiry.checkExpiry(supportInfo.domain);
                    if (domainExpiryDate) {
                        DomainExpiry.sendNotifications(
                            supportInfo.domain,
                            (await Monitor.getNotificationList(this)) || []
                        );
                    } else {
                        log.debug("monitor", `Failed getting expiration date for domain ${supportInfo.domain}`);
                    }
                } catch (error) {
                    if (
                        error.message === "domain_expiry_unsupported_unsupported_tld_no_rdap_endpoint" &&
                        Boolean(this.domain_expiry_notification)
                    ) {
                        log.warn(
                            "domain_expiry",
                            `Domain expiry unsupported for '.${error.meta.publicSuffix}' because its RDAP endpoint is not listed in the IANA database.`
                        );
                    }
                }
            }

            if (bean.status === UP) {
                log.debug(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Successful Response: ${bean.ping} ms | Interval: ${beatInterval} seconds | Type: ${this.type}`
                );
            } else if (bean.status === PENDING) {
                if (this.retry_interval > 0) {
                    beatInterval = this.retry_interval;
                }
                log.warn(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Pending: ${bean.msg} | Max retries: ${this.maxretries} | Retry: ${retries} | Retry Interval: ${beatInterval} seconds | Type: ${this.type}`
                );
            } else if (bean.status === MAINTENANCE) {
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Under Maintenance | Type: ${this.type}`);
            } else {
                log.warn(
                    "monitor",
                    `Monitor #${this.id} '${this.name}': Failing: ${bean.msg} | Interval: ${beatInterval} seconds | Type: ${this.type} | Down Count: ${bean.down_count} | Resend Interval: ${this.resend_interval}`
                );
            }

            // Calculate uptime
            let uptimeCalculator = await UptimeCalculator.getUptimeCalculator(this.id);
            let endTimeDayjs = await uptimeCalculator.update(bean.status, parseFloat(bean.ping));
            bean.end_time = isoDateTimeMillis(endTimeDayjs);

            // Send to frontend
            log.debug("monitor", `[${this.name}] Send to socket`);
            io.to(this.user_id).emit("heartbeat", bean.toJSON());
            Monitor.sendStats(io, this.id, this.user_id);

            // Store to database
            log.debug("monitor", `[${this.name}] Store`);
            await bean.$query().insertAndFetch();

            log.debug("monitor", `[${this.name}] prometheus.update`);
            const data24h = uptimeCalculator.get24Hour();
            const data30d = uptimeCalculator.get30Day();
            const data1y = uptimeCalculator.get1Year();
            this.prometheus?.update(bean, tlsInfo, { data24h, data30d, data1y });

            previousBeat = bean;

            if (!this.isStop) {
                log.debug("monitor", `[${this.name}] SetTimeout for next check.`);

                let intervalRemainingMs = Math.max(1, beatInterval * 1000 - dayjs().diff(dayjs.utc(bean.time)));

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

                if (!this.isStop) {
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
     * Save response body to a heartbeat if response saving is enabled.
     * @param {object} bean Heartbeat bean to populate.
     * @param {unknown} data Response payload.
     * @returns {void}
     */
    async saveResponseData(bean, data) {
        if (data === undefined) {
            return;
        }

        let responseData = data;
        if (typeof responseData !== "string") {
            try {
                responseData = JSON.stringify(responseData);
            } catch (error) {
                responseData = String(responseData);
            }
        }

        const maxSize = this.response_max_length ?? RESPONSE_BODY_LENGTH_DEFAULT;
        if (responseData.length > maxSize) {
            responseData = responseData.substring(0, maxSize) + "... (truncated)";
        }

        // Offload brotli compression from main event loop to libuv thread pool
        bean.response = (await brotliCompress(Buffer.from(responseData, "utf8"))).toString("base64");
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
                    domain: this.auth_domain,
                    workstation: this.auth_workstation ? this.auth_workstation : undefined,
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
                    Authorization: this.oauthAccessToken.token_type + " " + this.oauthAccessToken.access_token,
                };
                options.headers = { ...options.headers, ...oauth2AuthHeader };

                return this.makeAxiosRequest(options, true);
            }

            // Fix #2253
            // Read more: https://stackoverflow.com/questions/1759956/curl-error-18-transfer-closed-with-outstanding-read-data-remaining
            if (
                !finalCall &&
                typeof error.message === "string" &&
                error.message.includes("maxContentLength size of -1 exceeded")
            ) {
                log.debug("monitor", "makeAxiosRequest with gzip");
                options.headers["Accept-Encoding"] = "gzip, deflate";
                return this.makeAxiosRequest(options, true);
            } else {
                if (
                    typeof error.message === "string" &&
                    error.message.includes("maxContentLength size of -1 exceeded")
                ) {
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
     * Refresh per-monitor static config that beat() needs but should
     * not requery on every heartbeat (proxy and docker host beans).
     *
     * Called from start(); editMonitor flows go through stop() →
     * start(), so the cached values stay in sync without an explicit
     * invalidation hook on the running instance.
     * @returns {Promise<void>}
     */
    async _refreshStaticConfig() {
        if (this.proxy_id) {
            this._proxyBean = await ProxyModel.query().findById(this.proxy_id);
        } else {
            this._proxyBean = null;
        }
        if (this.docker_host) {
            this._dockerHostBean = await DockerHostModel.query().findById(this.docker_host);
        } else {
            this._dockerHostBean = null;
        }
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
        const knex = getKnex();
        let tlsInfoBean = await knex("monitor_tls_info").where("monitor_id", this.id).first();

        if (tlsInfoBean == null) {
            tlsInfoBean = { monitor_id: this.id };
        } else {
            // Clear sent history if the cert changed.
            // safeJsonParse logs at debug level: a missing/empty info_json
            // is normal on first run, so this should not surface as a warning.
            let oldCertInfo = safeJsonParse(tlsInfoBean.info_json, null, "monitor_tls_info.info_json", "debug");

            let isValidObjects =
                oldCertInfo && oldCertInfo.certInfo && checkCertificateResult && checkCertificateResult.certInfo;

            if (isValidObjects) {
                if (oldCertInfo.certInfo.fingerprint256 !== checkCertificateResult.certInfo.fingerprint256) {
                    log.debug("monitor", "Resetting sent_history");
                    await knex("notification_sent_history")
                        .where({ type: "certificate",
                            monitor_id: this.id })
                        .delete();
                } else {
                    log.debug("monitor", "No need to reset sent_history");
                    log.debug("monitor", oldCertInfo.certInfo.fingerprint256);
                    log.debug("monitor", checkCertificateResult.certInfo.fingerprint256);
                }
            } else {
                log.debug("monitor", "Not valid object");
            }
        }

        tlsInfoBean.info_json = JSON.stringify(checkCertificateResult);
        if (tlsInfoBean.id) {
            await knex("monitor_tls_info").where("id", tlsInfoBean.id).update({ info_json: tlsInfoBean.info_json });
        } else {
            await knex("monitor_tls_info").insert(tlsInfoBean);
        }

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

        return Boolean(active) && parentActive;
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
            io.to(userID).emit("avgPing", monitorID, data24h.avgPing ? Number(data24h.avgPing.toFixed(2)) : null);

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

            // Send domain info
            await Monitor.sendDomainInfo(io, monitorID, userID);
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
        let tlsInfo = await getKnex()("monitor_tls_info").where("monitor_id", monitorID).first();
        if (tlsInfo != null) {
            io.to(userID).emit("certInfo", monitorID, tlsInfo.info_json);
        }
    }

    /**
     * Send domain name information to client
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     * @returns {void}
     */
    static async sendDomainInfo(io, monitorID, userID) {
        const monitor = await Monitor.query().findById(monitorID);

        try {
            const supportInfo = await DomainExpiry.checkSupport(monitor);
            const domain = await DomainExpiry.findByDomainNameOrCreate(supportInfo.domain);
            if (domain?.expiry) {
                io.to(userID).emit("domainInfo", monitorID, domain.daysRemaining, new Date(domain.expiry));
            }
        } catch (e) {
            log.debug("monitor", `sendDomainInfo failed for monitor ${monitorID}: ${e.message}`);
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
        return (
            isFirstBeat ||
            (previousBeatStatus === DOWN && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === UP && currentBeatStatus === MAINTENANCE) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === UP) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN)
        );
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
        return (
            isFirstBeat ||
            (previousBeatStatus === MAINTENANCE && currentBeatStatus === DOWN) ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN)
        );
    }

    /**
     * Send a notification about a monitor
     * @param {boolean} isFirstBeat Is this beat the first of this monitor?
     * @param {Monitor} monitor The monitor to send a notification about
     * @param {import("./heartbeat")} bean Status information about monitor
     * @returns {Promise<void>}
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

            const heartbeatJSON = await bean.toJSONAsync({ decodeResponse: true });
            const monitorData = [{ id: monitor.id, active: monitor.active, name: monitor.name }];
            const preloadData = await Monitor.preparePreloadData(monitorData);
            // Prevent if the msg is undefined, notifications such as Discord cannot send out.
            if (!heartbeatJSON["msg"]) {
                heartbeatJSON["msg"] = "N/A";
            }

            // Also provide the time in server timezone
            heartbeatJSON["timezone"] = await UptimeKumaServer.getInstance().getTimezone();
            heartbeatJSON["timezoneOffset"] = UptimeKumaServer.getInstance().getTimezoneOffset();
            heartbeatJSON["localDateTime"] = dayjs
                .utc(heartbeatJSON["time"])
                .tz(heartbeatJSON["timezone"])
                .format(SQL_DATETIME_FORMAT);

            // Calculate downtime tracking information when service comes back up
            // This makes downtime information available to all notification providers
            if (bean.status === UP && monitor.id) {
                try {
                    // Filter by important = 1 to get the state transition heartbeat (e.g. UP→DOWN),
                    // not the most recent DOWN heartbeat which would be the last check before recovery.
                    const lastDownHeartbeat = await getKnex()("heartbeat")
                        .where({ monitor_id: monitor.id,
                            status: DOWN,
                            important: true })
                        .orderBy("time", "desc")
                        .first("time");

                    if (lastDownHeartbeat && lastDownHeartbeat.time) {
                        heartbeatJSON["lastDownTime"] = lastDownHeartbeat.time;
                    }
                } catch (error) {
                    // If we can't calculate downtime, just continue without it
                    // Silently fail to avoid disrupting notification sending
                    log.debug(
                        "monitor",
                        `[${monitor.name}] Could not calculate downtime information: ${error.message}`
                    );
                }
            }

            for (let notification of notificationList) {
                try {
                    await Notification.send(
                        JSON.parse(notification.config),
                        msg,
                        monitor.toJSON(preloadData, false),
                        heartbeatJSON
                    );
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
        return getKnex()("notification")
            .join("monitor_notification", "monitor_notification.notification_id", "notification.id")
            .where("monitor_notification.monitor_id", monitor.id)
            .select("notification.*");
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
        let row = await getKnex()("notification_sent_history")
            .where({ type: "certificate",
                monitor_id: this.id })
            .andWhere("days", "<=", targetDays)
            .first();

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
                await Notification.send(
                    JSON.parse(notification.config),
                    `[${this.name}][${this.url}] ${certType} certificate ${certCN} will expire in ${daysRemaining} days`
                );
                sent = true;
            } catch (e) {
                log.error("monitor", "Cannot send cert notification to " + notification.name);
                log.error("monitor", e);
            }
        }

        if (sent) {
            await getKnex()("notification_sent_history").insert({
                type: "certificate",
                monitor_id: this.id,
                days: targetDays,
            });
        }
    }

    /**
     * Get the status of the previous heartbeat
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<LooseObject<any>>} Previous heartbeat
     */
    static async getPreviousHeartbeat(monitorID) {
        return Heartbeat.query()
            .where("monitor_id", monitorID)
            .orderBy("id", "desc")
            .first();
    }

    /**
     * Check if monitor is under maintenance
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<boolean>} Is the monitor under maintenance
     */
    static async isUnderMaintenance(monitorID) {
        const rows = await getKnex()("monitor_maintenance")
            .where("monitor_id", monitorID)
            .pluck("maintenance_id");

        for (const maintenanceID of rows) {
            const maintenance = await UptimeKumaServer.getInstance().getMaintenance(maintenanceID);
            if (maintenance && (await maintenance.isUnderMaintenance())) {
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

        if (this.retry_interval > MAX_INTERVAL_SECOND) {
            throw new Error(`Retry interval cannot be more than ${MAX_INTERVAL_SECOND} seconds`);
        }
        if (this.retry_interval < MIN_INTERVAL_SECOND) {
            throw new Error(`Retry interval cannot be less than ${MIN_INTERVAL_SECOND} seconds`);
        }

        if (this.response_max_length !== undefined) {
            if (this.response_max_length < 0) {
                throw new Error(`Response max length cannot be less than 0`);
            }

            if (this.response_max_length > RESPONSE_BODY_LENGTH_MAX) {
                throw new Error(`Response max length cannot be more than ${RESPONSE_BODY_LENGTH_MAX} bytes`);
            }
        }

        // Validate port range for monitor types that use a port. Some types
        // (e.g. http, ping) have no port, so this is gated on a non-empty value.
        if (this.port !== null && this.port !== undefined && this.port !== "") {
            const p = Number(this.port);
            if (!Number.isInteger(p) || p < 1 || p > 65535) {
                throw new Error("Port must be an integer between 1 and 65535");
            }
        }

        // Validate JSON fields to prevent invalid JSON from being stored in database
        if (this.kafka_producer_brokers) {
            try {
                JSON.parse(this.kafka_producer_brokers);
            } catch (e) {
                throw new Error(`Kafka Producer Brokers must be valid JSON: ${e.message}`);
            }
        }

        if (this.kafka_producer_sasl_options) {
            try {
                JSON.parse(this.kafka_producer_sasl_options);
            } catch (e) {
                throw new Error(`Kafka Producer SASL Options must be valid JSON: ${e.message}`);
            }
        }

        if (this.rabbitmq_nodes) {
            try {
                JSON.parse(this.rabbitmq_nodes);
            } catch (e) {
                throw new Error(`RabbitMQ Nodes must be valid JSON: ${e.message}`);
            }
        }

        if (this.conditions) {
            try {
                JSON.parse(this.conditions);
            } catch (e) {
                throw new Error(`Conditions must be valid JSON: ${e.message}`);
            }
        }

        if (this.headers) {
            try {
                JSON.parse(this.headers);
            } catch (e) {
                throw new Error(`Headers must be valid JSON: ${e.message}`);
            }
        }

        if (this.accepted_statuscodes_json) {
            try {
                JSON.parse(this.accepted_statuscodes_json);
            } catch (e) {
                throw new Error(`Accepted status codes must be valid JSON: ${e.message}`);
            }
        }

        if (this.type === "ping") {
            // ping parameters validation
            if (this.packet_size && (this.packet_size < PING_PACKET_SIZE_MIN || this.packet_size > PING_PACKET_SIZE_MAX)) {
                throw new Error(
                    `Packet size must be between ${PING_PACKET_SIZE_MIN} and ${PING_PACKET_SIZE_MAX} (default: ${PING_PACKET_SIZE_DEFAULT})`
                );
            }

            if (
                this.ping_per_request_timeout &&
                (this.ping_per_request_timeout < PING_PER_REQUEST_TIMEOUT_MIN ||
                    this.ping_per_request_timeout > PING_PER_REQUEST_TIMEOUT_MAX)
            ) {
                throw new Error(
                    `Per-ping timeout must be between ${PING_PER_REQUEST_TIMEOUT_MIN} and ${PING_PER_REQUEST_TIMEOUT_MAX} seconds (default: ${PING_PER_REQUEST_TIMEOUT_DEFAULT})`
                );
            }

            if (this.ping_count && (this.ping_count < PING_COUNT_MIN || this.ping_count > PING_COUNT_MAX)) {
                throw new Error(
                    `Echo requests count must be between ${PING_COUNT_MIN} and ${PING_COUNT_MAX} (default: ${PING_COUNT_DEFAULT})`
                );
            }

            if (this.timeout) {
                const pingGlobalTimeout = Math.round(Number(this.timeout));

                if (
                    pingGlobalTimeout < this.ping_per_request_timeout ||
                    pingGlobalTimeout < PING_GLOBAL_TIMEOUT_MIN ||
                    pingGlobalTimeout > PING_GLOBAL_TIMEOUT_MAX
                ) {
                    throw new Error(
                        `Timeout must be between ${PING_GLOBAL_TIMEOUT_MIN} and ${PING_GLOBAL_TIMEOUT_MAX} seconds (default: ${PING_GLOBAL_TIMEOUT_DEFAULT})`
                    );
                }

                this.timeout = pingGlobalTimeout;
            }
        }

        if (this.type === "real-browser") {
            // screenshot_delay validation
            if (this.screenshot_delay !== undefined && this.screenshot_delay !== null) {
                const delay = Number(this.screenshot_delay);
                if (isNaN(delay) || delay < 0) {
                    throw new Error("Screenshot delay must be a non-negative number");
                }

                // Must not exceed 0.8 * timeout (page.goto timeout is interval * 1000 * 0.8)
                const maxDelayFromTimeout = this.interval * 1000 * 0.8;
                if (delay >= maxDelayFromTimeout) {
                    throw new Error(`Screenshot delay must be less than ${maxDelayFromTimeout}ms (0.8 × interval)`);
                }

                // Must not exceed 0.5 * interval to prevent blocking next check
                const maxDelayFromInterval = this.interval * 1000 * 0.5;
                if (delay >= maxDelayFromInterval) {
                    throw new Error(`Screenshot delay must be less than ${maxDelayFromInterval}ms (0.5 × interval)`);
                }
            }
        }

        if (this.type === "mongodb" && this.database_query) {
            // Validate that databaseQuery is valid JSON
            try {
                JSON.parse(this.database_query);
            } catch (error) {
                throw new Error(`Invalid JSON in database query: ${error.message}`);
            }
        }
    }

    /**
     * Gets monitor notification of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorNotification(monitorIDs) {
        return getKnex()("monitor_notification")
            .whereIn("monitor_id", monitorIDs)
            .select("monitor_id", "notification_id");
    }

    /**
     * Gets monitor tags of multiple monitor
     * @param {Array} monitorIDs IDs of monitor to get
     * @returns {Promise<LooseObject<any>>} object
     */
    static async getMonitorTag(monitorIDs) {
        return getKnex()("monitor_tag")
            .join("tag", "monitor_tag.tag_id", "tag.id")
            .whereIn("monitor_tag.monitor_id", monitorIDs)
            .select("monitor_tag.monitor_id", "monitor_tag.tag_id", "monitor_tag.value", "tag.name", "tag.color");
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
            const monitorIDs = monitorData.map((monitor) => monitor.id);
            const notifications = await Monitor.getMonitorNotification(monitorIDs);
            const tags = await Monitor.getMonitorTag(monitorIDs);
            const maintenanceStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isUnderMaintenance(monitor.id))
            );

            // Load the full monitor adjacency list once and reuse it for both
            // children traversal and path lookups. Avoids O(n*depth) round-trips.
            const adjacencyRows = await getKnex()("monitor").select("id", "name", "parent");
            const childrenByParent = new Map();
            const monitorsByID = new Map();
            for (const row of adjacencyRows) {
                monitorsByID.set(row.id, row);
                if (row.parent === null || row.parent === undefined) {
                    continue;
                }
                if (!childrenByParent.has(row.parent)) {
                    childrenByParent.set(row.parent, []);
                }
                childrenByParent.get(row.parent).push(row.id);
            }

            const childrenIDs = monitorData.map((monitor) =>
                Monitor.collectChildrenIDs(monitor.id, childrenByParent)
            );
            const activeStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isActive(monitor.id, monitor.active))
            );
            const forceInactiveStatuses = await Promise.all(
                monitorData.map((monitor) => Monitor.isParentActive(monitor.id))
            );
            const paths = monitorData.map((monitor) =>
                Monitor.buildPathFromMap(monitor.id, monitor.name, monitorsByID)
            );

            notifications.forEach((row) => {
                if (!notificationsMap.has(row.monitor_id)) {
                    notificationsMap.set(row.monitor_id, {});
                }
                notificationsMap.get(row.monitor_id)[row.notification_id] = true;
            });

            tags.forEach((row) => {
                if (!tagsMap.has(row.monitor_id)) {
                    tagsMap.set(row.monitor_id, []);
                }
                tagsMap.get(row.monitor_id).push({
                    tag_id: row.tag_id,
                    monitor_id: row.monitor_id,
                    value: row.value,
                    name: row.name,
                    color: row.color,
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
        // .first() returns undefined when there is no parent row; normalise
        // to null so callers can use the historical `parent === null` check.
        const row = await getKnex()({ parent: "monitor" })
            .leftJoin({ child: "monitor" }, "child.parent", "parent.id")
            .where("child.id", monitorID)
            .first("parent.*");
        return row ?? null;
    }

    /**
     * Gets all Children of the monitor
     * @param {number} monitorID ID of monitor to get
     * @param {import("knex").Knex.Transaction|null} trx Knex transaction
     * to run inside, or null to use the shared connection.
     * @returns {Promise<LooseObject<any>[]>} Children
     */
    static async getChildren(monitorID, trx) {
        const db = trx || getKnex();
        return db("monitor").where("parent", monitorID);
    }

    /**
     * Gets the full path
     * @param {number} monitorID ID of the monitor to get
     * @param {string} name of the monitor to get
     * @returns {Promise<string[]>} Full path (includes groups and the name) of the monitor
     */
    static async getAllPath(monitorID, name) {
        // Load the full adjacency list in one query and walk in-memory rather
        // than issuing one query per ancestor level.
        const rows = await getKnex()("monitor").select("id", "name", "parent");
        const monitorsByID = new Map();
        for (const row of rows) {
            monitorsByID.set(row.id, row);
        }
        return Monitor.buildPathFromMap(monitorID, name, monitorsByID);
    }

    /**
     * Walk the in-memory monitor map to build the full ancestor path.
     * Includes cycle protection via a `seen` set so a malformed parent loop
     * cannot cause an infinite walk.
     * @param {number} monitorID ID of the monitor to get
     * @param {string} name name of the monitor to get
     * @param {Map<number, {id: number, name: string, parent: number|null}>} monitorsByID adjacency map
     * @returns {string[]} Full path (includes groups and the name) of the monitor
     */
    static buildPathFromMap(monitorID, name, monitorsByID) {
        const path = [name];
        const seen = new Set([monitorID]);

        const start = monitorsByID.get(monitorID);
        let parentID = start ? start.parent : null;

        while (parentID !== null && parentID !== undefined && !seen.has(parentID)) {
            seen.add(parentID);
            const parent = monitorsByID.get(parentID);
            if (!parent) {
                break;
            }
            path.unshift(parent.name);
            parentID = parent.parent;
        }

        return path;
    }

    /**
     * Gets recursive all child ids
     *
     * Loads the full monitor adjacency list in a single query and traverses it
     * in-memory. Previously this method recursed with one DB round-trip per
     * level, producing O(depth * branching) queries; now it is O(1) queries.
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<Array>} IDs of all children
     */
    static async getAllChildrenIDs(monitorID) {
        const rows = await getKnex()("monitor").select("id", "parent");
        const childrenByParent = new Map();
        for (const row of rows) {
            if (row.parent === null || row.parent === undefined) {
                continue;
            }
            if (!childrenByParent.has(row.parent)) {
                childrenByParent.set(row.parent, []);
            }
            childrenByParent.get(row.parent).push(row.id);
        }
        return Monitor.collectChildrenIDs(monitorID, childrenByParent);
    }

    /**
     * Walk an in-memory adjacency map (parent -> [child ids]) and collect every
     * descendant of `monitorID`. Cycle-safe via a `seen` set.
     * @param {number} monitorID ID of the monitor to traverse from
     * @param {Map<number, number[]>} childrenByParent adjacency map keyed by parent ID
     * @returns {number[]} IDs of all descendants
     */
    static collectChildrenIDs(monitorID, childrenByParent) {
        const out = [];
        const stack = [monitorID];
        const seen = new Set();
        while (stack.length) {
            const id = stack.pop();
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
            const kids = childrenByParent.get(id) || [];
            for (const kid of kids) {
                if (seen.has(kid)) {
                    continue;
                }
                out.push(kid);
                stack.push(kid);
            }
        }
        return out;
    }

    /**
     * Unlinks all children of the group monitor
     * @param {number} groupID ID of group to remove children of
     * @param {import("knex").Knex.Transaction|null} trx Knex transaction
     * to run inside, or null to use the shared connection.
     * @returns {Promise<void>}
     */
    static async unlinkAllChildren(groupID, trx) {
        const db = trx || getKnex();
        return await db("monitor").where("parent", groupID).update({ parent: null });
    }

    /**
     * Delete a monitor from the system. The DB delete is performed inside
     * `trx` when provided so a parent transaction can roll back on failure.
     * The in-memory monitor stop is a side-effect and runs regardless.
     * @param {number} monitorID ID of the monitor to delete
     * @param {number} userID ID of the user who owns the monitor
     * @param {import("knex").Knex.Transaction|null} trx Knex transaction
     * to run inside, or null to use the shared connection.
     * @returns {Promise<void>}
     */
    static async deleteMonitor(monitorID, userID, trx) {
        const server = UptimeKumaServer.getInstance();

        // Stop the monitor if it's running
        if (monitorID in server.monitorList) {
            await server.monitorList[monitorID].stop();
            delete server.monitorList[monitorID];
        }

        // Delete from database
        const db = trx || getKnex();
        await db("monitor").where({ id: monitorID,
            user_id: userID }).delete();
    }

    /**
     * Recursively delete a monitor and all its descendants. When `trx` is
     * provided every descendant delete runs inside it, so a failure mid
     * cascade rolls the whole tree back atomically.
     * @param {number} monitorID ID of the monitor to delete
     * @param {number} userID ID of the user who owns the monitor
     * @param {import("knex").Knex.Transaction|null} trx Knex transaction
     * to run inside, or null to use the shared connection.
     * @returns {Promise<void>}
     */
    static async deleteMonitorRecursively(monitorID, userID, trx) {
        // Check if this monitor is a group
        const lookup = trx ? Monitor.query(trx) : Monitor.query();
        const monitor = await lookup.where({ id: monitorID,
            user_id: userID }).first();

        if (monitor && monitor.type === "group") {
            // Get all children and delete them recursively
            const children = await Monitor.getChildren(monitorID, trx);
            if (children && children.length > 0) {
                for (const child of children) {
                    await Monitor.deleteMonitorRecursively(child.id, userID, trx);
                }
            }
        }

        // Delete the monitor itself
        await Monitor.deleteMonitor(monitorID, userID, trx);
    }

    /**
     * Checks recursive if parent (ancestors) are active
     * @param {number} monitorID ID of the monitor to get
     * @returns {Promise<boolean>} Is the parent monitor active?
     */
    static async isParentActive(monitorID) {
        const parent = await Monitor.getParent(monitorID);

        // Knex `.first()` returns undefined when there is no parent row;
        // also bail out if the LEFT JOIN gave us a stub with no id.
        if (parent == null || parent.id == null) {
            return true;
        }

        const parentActive = await Monitor.isParentActive(parent.id);
        return Boolean(parent.active) && parentActive;
    }

    /**
     * Obtains a new Oidc Token
     * @returns {Promise<object>} OAuthProvider client
     */
    async makeOidcTokenClientCredentialsRequest() {
        log.debug("monitor", `[${this.name}] The oauth access-token undefined or expired. Requesting a new token`);
        const oAuthAccessToken = await getOidcTokenClientCredentials(
            this.oauth_token_url,
            this.oauth_client_id,
            this.oauth_client_secret,
            this.oauth_scopes,
            this.oauth_audience,
            this.oauth_auth_method
        );
        if (this.oauthAccessToken?.expires_at) {
            log.debug(
                "monitor",
                `[${this.name}] Obtained oauth access-token. Expires at ${new Date(this.oauthAccessToken?.expires_at * 1000)}`
            );
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
        this.prometheus?.update(null, tlsInfo, null);

        if (!this.getIgnoreTls() && this.isEnabledExpiryNotification()) {
            log.debug("monitor", `[${this.name}] call checkCertExpiryNotifications`);
            await checkCertExpiryNotifications(this, tlsInfo);
        }
    }
}

module.exports = Monitor;
