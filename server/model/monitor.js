const https = require("https");
const dayjs = require("dayjs");
const axios = require("axios");
const { Prometheus } = require("../prometheus");
const { log, UP, DOWN, PENDING, MAINTENANCE, flipStatus, TimeLogger, MAX_INTERVAL_SECOND, MIN_INTERVAL_SECOND } = require("../../src/util");
const { tcping, ping, dnsResolve, checkCertificate, checkStatusCode, getTotalClientInRoom, setting, mssqlQuery, postgresQuery, mysqlQuery, mqttAsync, setSetting, httpNtlm, radius, grpcQuery } = require("../util-server");
const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const { Notification } = require("../notification");
const { Proxy } = require("../proxy");
const { demoMode } = require("../config");
const version = require("../../package.json").version;
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { CacheableDnsHttpAgent } = require("../cacheable-dns-http-agent");
const { DockerHost } = require("../docker");
const Maintenance = require("./maintenance");
const { UptimeCacheList } = require("../uptime-cache-list");

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 *      3 = MAINTENANCE
 */
class Monitor extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
    async toPublicJSON(showTags = false) {
        let obj = {
            id: this.id,
            name: this.name,
            sendUrl: this.sendUrl,
            maintenance: await Monitor.isUnderMaintenance(this.id),
        };

        if (this.sendUrl) {
            obj.url = this.url;
        }

        if (showTags) {
            obj.tags = await this.getTags();
        }
        return obj;
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    async toJSON(includeSensitiveData = true) {

        let notificationIDList = {};

        let list = await R.find("monitor_notification", " monitor_id = ? ", [
            this.id,
        ]);

        for (let bean of list) {
            notificationIDList[bean.notification_id] = true;
        }

        const tags = await this.getTags();

        let data = {
            id: this.id,
            name: this.name,
            url: this.url,
            method: this.method,
            hostname: this.hostname,
            port: this.port,
            maxretries: this.maxretries,
            weight: this.weight,
            active: this.active,
            type: this.type,
            interval: this.interval,
            retryInterval: this.retryInterval,
            resendInterval: this.resendInterval,
            keyword: this.keyword,
            expiryNotification: this.isEnabledExpiryNotification(),
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            maxredirects: this.maxredirects,
            accepted_statuscodes: this.getAcceptedStatuscodes(),
            dns_resolve_type: this.dns_resolve_type,
            dns_resolve_server: this.dns_resolve_server,
            dns_last_result: this.dns_last_result,
            docker_container: this.docker_container,
            docker_host: this.docker_host,
            proxyId: this.proxy_id,
            notificationIDList,
            tags: tags,
            maintenance: await Monitor.isUnderMaintenance(this.id),
            mqttTopic: this.mqttTopic,
            mqttSuccessMessage: this.mqttSuccessMessage,
            databaseQuery: this.databaseQuery,
            authMethod: this.authMethod,
            grpcUrl: this.grpcUrl,
            grpcProtobuf: this.grpcProtobuf,
            grpcMethod: this.grpcMethod,
            grpcServiceName: this.grpcServiceName,
            grpcEnableTls: this.getGrpcEnableTls(),
            radiusCalledStationId: this.radiusCalledStationId,
            radiusCallingStationId: this.radiusCallingStationId,
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
                pushToken: this.pushToken,
                databaseConnectionString: this.databaseConnectionString,
                radiusUsername: this.radiusUsername,
                radiusPassword: this.radiusPassword,
                radiusSecret: this.radiusSecret,
                mqttUsername: this.mqttUsername,
                mqttPassword: this.mqttPassword,
                authWorkstation: this.authWorkstation,
                authDomain: this.authDomain,
            };
        }

        data.includeSensitiveData = includeSensitiveData;
        return data;
    }

    /**
     * Get all tags applied to this monitor
     * @returns {Promise<LooseObject<any>[]>}
     */
    async getTags() {
        return await R.getAll("SELECT mt.*, tag.name, tag.color FROM monitor_tag mt JOIN tag ON mt.tag_id = tag.id WHERE mt.monitor_id = ?", [ this.id ]);
    }

    /**
     * Encode user and password to Base64 encoding
     * for HTTP "basic" auth, as per RFC-7617
     * @returns {string}
     */
    encodeBase64(user, pass) {
        return Buffer.from(user + ":" + pass).toString("base64");
    }

    /**
     * Is the TLS expiry notification enabled?
     * @returns {boolean}
     */
    isEnabledExpiryNotification() {
        return Boolean(this.expiryNotification);
    }

    /**
     * Parse to boolean
     * @returns {boolean}
     */
    getIgnoreTls() {
        return Boolean(this.ignoreTls);
    }

    /**
     * Parse to boolean
     * @returns {boolean}
     */
    isUpsideDown() {
        return Boolean(this.upsideDown);
    }

    /**
     * Parse to boolean
     * @returns {boolean}
     */
    getGrpcEnableTls() {
        return Boolean(this.grpcEnableTls);
    }

    /**
     * Get accepted status codes
     * @returns {Object}
     */
    getAcceptedStatuscodes() {
        return JSON.parse(this.accepted_statuscodes_json);
    }

    /**
     * Start monitor
     * @param {Server} io Socket server instance
     */
    start(io) {
        let previousBeat = null;
        let retries = 0;

        let prometheus = new Prometheus(this);

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

            // Duration
            if (!isFirstBeat) {
                bean.duration = dayjs(bean.time).diff(dayjs(previousBeat.time), "second");
            } else {
                bean.duration = 0;
            }

            try {
                if (await Monitor.isUnderMaintenance(this.id)) {
                    bean.msg = "Monitor under maintenance";
                    bean.status = MAINTENANCE;
                } else if (this.type === "http" || this.type === "keyword") {
                    // Do not do any queries/high loading things before the "bean.ping"
                    let startTime = dayjs().valueOf();

                    // HTTP basic auth
                    let basicAuthHeader = {};
                    if (this.auth_method === "basic") {
                        basicAuthHeader = {
                            "Authorization": "Basic " + this.encodeBase64(this.basic_auth_user, this.basic_auth_pass),
                        };
                    }

                    const httpsAgentOptions = {
                        maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                        rejectUnauthorized: !this.getIgnoreTls(),
                    };

                    log.debug("monitor", `[${this.name}] Prepare Options for axios`);

                    // Axios Options
                    const options = {
                        url: this.url,
                        method: (this.method || "get").toLowerCase(),
                        ...(this.body ? { data: JSON.parse(this.body) } : {}),
                        timeout: this.interval * 1000 * 0.8,
                        headers: {
                            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                            "User-Agent": "Uptime-Kuma/" + version,
                            ...(this.headers ? JSON.parse(this.headers) : {}),
                            ...(basicAuthHeader),
                        },
                        maxRedirects: this.maxredirects,
                        validateStatus: (status) => {
                            return checkStatusCode(status, this.getAcceptedStatuscodes());
                        },
                    };

                    if (this.proxy_id) {
                        const proxy = await R.load("proxy", this.proxy_id);

                        if (proxy && proxy.active) {
                            const { httpAgent, httpsAgent } = Proxy.createAgents(proxy, {
                                httpsAgentOptions: httpsAgentOptions,
                            });

                            options.proxy = false;
                            options.httpAgent = httpAgent;
                            options.httpsAgent = httpsAgent;
                        }
                    }

                    if (!options.httpsAgent) {
                        options.httpsAgent = new https.Agent(httpsAgentOptions);
                    }

                    log.debug("monitor", `[${this.name}] Axios Options: ${JSON.stringify(options)}`);
                    log.debug("monitor", `[${this.name}] Axios Request`);

                    // Make Request
                    let res = await this.makeAxiosRequest(options);

                    bean.msg = `${res.status} - ${res.statusText}`;
                    bean.ping = dayjs().valueOf() - startTime;

                    // Check certificate if https is used
                    let certInfoStartTime = dayjs().valueOf();
                    if (this.getUrl()?.protocol === "https:") {
                        log.debug("monitor", `[${this.name}] Check cert`);
                        try {
                            let tlsInfoObject = checkCertificate(res);
                            tlsInfo = await this.updateTlsInfo(tlsInfoObject);

                            if (!this.getIgnoreTls() && this.isEnabledExpiryNotification()) {
                                log.debug("monitor", `[${this.name}] call sendCertNotification`);
                                await this.sendCertNotification(tlsInfoObject);
                            }

                        } catch (e) {
                            if (e.message !== "No TLS certificate in response") {
                                log.error("monitor", "Caught error");
                                log.error("monitor", e.message);
                            }
                        }
                    }

                    if (process.env.TIMELOGGER === "1") {
                        log.debug("monitor", "Cert Info Query Time: " + (dayjs().valueOf() - certInfoStartTime) + "ms");
                    }

                    if (process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID === this.id) {
                        log.info("monitor", res.data);
                    }

                    if (this.type === "http") {
                        bean.status = UP;
                    } else {

                        let data = res.data;

                        // Convert to string for object/array
                        if (typeof data !== "string") {
                            data = JSON.stringify(data);
                        }

                        if (data.includes(this.keyword)) {
                            bean.msg += ", keyword is found";
                            bean.status = UP;
                        } else {
                            data = data.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ");
                            if (data.length > 50) {
                                data = data.substring(0, 47) + "...";
                            }
                            throw new Error(bean.msg + ", but keyword is not in [" + data + "]");
                        }

                    }

                } else if (this.type === "port") {
                    bean.ping = await tcping(this.hostname, this.port);
                    bean.msg = "";
                    bean.status = UP;

                } else if (this.type === "ping") {
                    bean.ping = await ping(this.hostname);
                    bean.msg = "";
                    bean.status = UP;
                } else if (this.type === "dns") {
                    let startTime = dayjs().valueOf();
                    let dnsMessage = "";

                    let dnsRes = await dnsResolve(this.hostname, this.dns_resolve_server, this.port, this.dns_resolve_type);
                    bean.ping = dayjs().valueOf() - startTime;

                    if (this.dns_resolve_type === "A" || this.dns_resolve_type === "AAAA" || this.dns_resolve_type === "TXT") {
                        dnsMessage += "Records: ";
                        dnsMessage += dnsRes.join(" | ");
                    } else if (this.dns_resolve_type === "CNAME" || this.dns_resolve_type === "PTR") {
                        dnsMessage = dnsRes[0];
                    } else if (this.dns_resolve_type === "CAA") {
                        dnsMessage = dnsRes[0].issue;
                    } else if (this.dns_resolve_type === "MX") {
                        dnsRes.forEach(record => {
                            dnsMessage += `Hostname: ${record.exchange} - Priority: ${record.priority} | `;
                        });
                        dnsMessage = dnsMessage.slice(0, -2);
                    } else if (this.dns_resolve_type === "NS") {
                        dnsMessage += "Servers: ";
                        dnsMessage += dnsRes.join(" | ");
                    } else if (this.dns_resolve_type === "SOA") {
                        dnsMessage += `NS-Name: ${dnsRes.nsname} | Hostmaster: ${dnsRes.hostmaster} | Serial: ${dnsRes.serial} | Refresh: ${dnsRes.refresh} | Retry: ${dnsRes.retry} | Expire: ${dnsRes.expire} | MinTTL: ${dnsRes.minttl}`;
                    } else if (this.dns_resolve_type === "SRV") {
                        dnsRes.forEach(record => {
                            dnsMessage += `Name: ${record.name} | Port: ${record.port} | Priority: ${record.priority} | Weight: ${record.weight} | `;
                        });
                        dnsMessage = dnsMessage.slice(0, -2);
                    }

                    if (this.dnsLastResult !== dnsMessage) {
                        R.exec("UPDATE `monitor` SET dns_last_result = ? WHERE id = ? ", [
                            dnsMessage,
                            this.id
                        ]);
                    }

                    bean.msg = dnsMessage;
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
                            this.heartbeatInterval = setTimeout(beat, timeout);
                            return;
                        }
                    } else {
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
                        timeout: this.interval * 1000 * 0.8,
                        headers: {
                            "Accept": "*/*",
                            "User-Agent": "Uptime-Kuma/" + version,
                        },
                        httpsAgent: CacheableDnsHttpAgent.getHttpsAgent({
                            maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
                        }),
                        httpAgent: CacheableDnsHttpAgent.getHttpAgent({
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
                            bean.ping = await ping(this.hostname);
                        } catch (_) { }
                    } else {
                        throw new Error("Server not found on Steam");
                    }
                } else if (this.type === "docker") {
                    log.debug(`[${this.name}] Prepare Options for Axios`);

                    const dockerHost = await R.load("docker_host", this.docker_host);

                    const options = {
                        url: `/containers/${this.docker_container}/json`,
                        headers: {
                            "Accept": "*/*",
                            "User-Agent": "Uptime-Kuma/" + version,
                        },
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: ! this.getIgnoreTls(),
                        }),
                    };

                    if (dockerHost._dockerType === "socket") {
                        options.socketPath = dockerHost._dockerDaemon;
                    } else if (dockerHost._dockerType === "tcp") {
                        options.baseURL = DockerHost.patchDockerURL(dockerHost._dockerDaemon);
                    }

                    log.debug(`[${this.name}] Axios Request`);
                    let res = await axios.request(options);
                    if (res.data.State.Running) {
                        bean.status = UP;
                        bean.msg = res.data.State.Status;
                    } else {
                        throw Error("Container State is " + res.data.State.Status);
                    }
                } else if (this.type === "mqtt") {
                    bean.msg = await mqttAsync(this.hostname, this.mqttTopic, this.mqttSuccessMessage, {
                        port: this.port,
                        username: this.mqttUsername,
                        password: this.mqttPassword,
                        interval: this.interval,
                    });
                    bean.status = UP;
                } else if (this.type === "sqlserver") {
                    let startTime = dayjs().valueOf();

                    await mssqlQuery(this.databaseConnectionString, this.databaseQuery);

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
                        keyword: this.keyword
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
                        if (response.data.toString().includes(this.keyword)) {
                            bean.status = UP;
                            bean.msg = `${responseData}, keyword [${this.keyword}] is found`;
                        } else {
                            log.debug("monitor:", `GRPC response [${response.data}] + ", but keyword [${this.keyword}] is not in [" + ${response.data} + "]"`);
                            bean.status = DOWN;
                            bean.msg = `, but keyword [${this.keyword}] is not in [" + ${responseData} + "]`;
                        }
                    }
                } else if (this.type === "postgres") {
                    let startTime = dayjs().valueOf();

                    await postgresQuery(this.databaseConnectionString, this.databaseQuery);

                    bean.msg = "";
                    bean.status = UP;
                    bean.ping = dayjs().valueOf() - startTime;
                } else if (this.type === "mysql") {
                    let startTime = dayjs().valueOf();

                    await mysqlQuery(this.databaseConnectionString, this.databaseQuery);

                    bean.msg = "";
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

                    try {
                        const resp = await radius(
                            this.hostname,
                            this.radiusUsername,
                            this.radiusPassword,
                            this.radiusCalledStationId,
                            this.radiusCallingStationId,
                            this.radiusSecret,
                            port
                        );
                        if (resp.code) {
                            bean.msg = resp.code;
                        }
                        bean.status = UP;
                    } catch (error) {
                        bean.status = DOWN;
                        if (error.response?.code) {
                            bean.msg = error.response.code;
                        } else {
                            bean.msg = error.message;
                        }
                    }
                    bean.ping = dayjs().valueOf() - startTime;
                } else {
                    bean.msg = "Unknown Monitor Type";
                    bean.status = PENDING;
                }

                if (this.isUpsideDown()) {
                    bean.status = flipStatus(bean.status);

                    if (bean.status === DOWN) {
                        throw new Error("Flip UP to DOWN");
                    }
                }

                retries = 0;

            } catch (error) {

                bean.msg = error.message;

                // If UP come in here, it must be upside down mode
                // Just reset the retries
                if (this.isUpsideDown() && bean.status === UP) {
                    retries = 0;

                } else if ((this.maxretries > 0) && (retries < this.maxretries)) {
                    retries++;
                    bean.status = PENDING;
                }
            }

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

                UptimeKumaServer.getInstance().sendMaintenanceListByUserID(this.user_id);

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

            log.debug("monitor", `[${this.name}] Send to socket`);
            UptimeCacheList.clearCache(this.id);
            io.to(this.user_id).emit("heartbeat", bean.toJSON());
            Monitor.sendStats(io, this.id, this.user_id);

            log.debug("monitor", `[${this.name}] Store`);
            await R.store(bean);

            log.debug("monitor", `[${this.name}] prometheus.update`);
            prometheus.update(bean, tlsInfo);

            previousBeat = bean;

            if (! this.isStop) {
                log.debug("monitor", `[${this.name}] SetTimeout for next check.`);
                this.heartbeatInterval = setTimeout(safeBeat, beatInterval * 1000);
            } else {
                log.info("monitor", `[${this.name}] isStop = true, no next check.`);
            }

        };

        /** Get a heartbeat and handle errors */
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
        } catch (e) {
            // Fix #2253
            // Read more: https://stackoverflow.com/questions/1759956/curl-error-18-transfer-closed-with-outstanding-read-data-remaining
            if (!finalCall && typeof e.message === "string" && e.message.includes("maxContentLength size of -1 exceeded")) {
                log.debug("monitor", "makeAxiosRequest with gzip");
                options.headers["Accept-Encoding"] = "gzip, deflate";
                return this.makeAxiosRequest(options, true);
            } else {
                if (typeof e.message === "string" && e.message.includes("maxContentLength size of -1 exceeded")) {
                    e.message = "response timeout: incomplete response within a interval";
                }
                throw e;
            }
        }
    }

    /** Stop monitor */
    stop() {
        clearTimeout(this.heartbeatInterval);
        this.isStop = true;

        this.prometheus().remove();
    }

    /**
     * Get a new prometheus instance
     * @returns {Prometheus}
     */
    prometheus() {
        return new Prometheus(this);
    }

    /**
     * Helper Method:
     * returns URL object for further usage
     * returns null if url is invalid
     * @returns {(null|URL)}
     */
    getUrl() {
        try {
            return new URL(this.url);
        } catch (_) {
            return null;
        }
    }

    /**
     * Store TLS info to database
     * @param checkCertificateResult
     * @returns {Promise<Object>}
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
     * Send statistics to clients
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     */
    static async sendStats(io, monitorID, userID) {
        const hasClients = getTotalClientInRoom(io, userID) > 0;

        if (hasClients) {
            await Monitor.sendAvgPing(24, io, monitorID, userID);
            await Monitor.sendUptime(24, io, monitorID, userID);
            await Monitor.sendUptime(24 * 30, io, monitorID, userID);
            await Monitor.sendCertInfo(io, monitorID, userID);
        } else {
            log.debug("monitor", "No clients in the room, no need to send stats");
        }
    }

    /**
     * Send the average ping to user
     * @param {number} duration Hours
     */
    static async sendAvgPing(duration, io, monitorID, userID) {
        const timeLogger = new TimeLogger();

        let avgPing = parseInt(await R.getCell(`
            SELECT AVG(ping)
            FROM heartbeat
            WHERE time > DATETIME('now', ? || ' hours')
            AND ping IS NOT NULL
            AND monitor_id = ? `, [
            -duration,
            monitorID,
        ]));

        timeLogger.print(`[Monitor: ${monitorID}] avgPing`);

        io.to(userID).emit("avgPing", monitorID, avgPing);
    }

    /**
     * Send certificate information to client
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
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
     * Uptime with calculation
     * Calculation based on:
     * https://www.uptrends.com/support/kb/reporting/calculation-of-uptime-and-downtime
     * @param {number} duration Hours
     * @param {number} monitorID ID of monitor to calculate
     */
    static async calcUptime(duration, monitorID, forceNoCache = false) {

        if (!forceNoCache) {
            let cachedUptime = UptimeCacheList.getUptime(monitorID, duration);
            if (cachedUptime != null) {
                return cachedUptime;
            }
        }

        const timeLogger = new TimeLogger();

        const startTime = R.isoDateTime(dayjs.utc().subtract(duration, "hour"));

        // Handle if heartbeat duration longer than the target duration
        // e.g. If the last beat's duration is bigger that the 24hrs window, it will use the duration between the (beat time - window margin) (THEN case in SQL)
        let result = await R.getRow(`
            SELECT
               -- SUM all duration, also trim off the beat out of time window
                SUM(
                    CASE
                        WHEN (JULIANDAY(\`time\`) - JULIANDAY(?)) * 86400 < duration
                        THEN (JULIANDAY(\`time\`) - JULIANDAY(?)) * 86400
                        ELSE duration
                    END
                ) AS total_duration,

               -- SUM all uptime duration, also trim off the beat out of time window
                SUM(
                    CASE
                        WHEN (status = 1 OR status = 3)
                        THEN
                            CASE
                                WHEN (JULIANDAY(\`time\`) - JULIANDAY(?)) * 86400 < duration
                                    THEN (JULIANDAY(\`time\`) - JULIANDAY(?)) * 86400
                                ELSE duration
                            END
                        END
                ) AS uptime_duration
            FROM heartbeat
            WHERE time > ?
            AND monitor_id = ?
        `, [
            startTime, startTime, startTime, startTime, startTime,
            monitorID,
        ]);

        timeLogger.print(`[Monitor: ${monitorID}][${duration}] sendUptime`);

        let totalDuration = result.total_duration;
        let uptimeDuration = result.uptime_duration;
        let uptime = 0;

        if (totalDuration > 0) {
            uptime = uptimeDuration / totalDuration;
            if (uptime < 0) {
                uptime = 0;
            }

        } else {
            // Handle new monitor with only one beat, because the beat's duration = 0
            let status = parseInt(await R.getCell("SELECT `status` FROM heartbeat WHERE monitor_id = ?", [ monitorID ]));

            if (status === UP) {
                uptime = 1;
            }
        }

        // Cache
        UptimeCacheList.addUptime(monitorID, duration, uptime);

        return uptime;
    }

    /**
     * Send Uptime
     * @param {number} duration Hours
     * @param {Server} io Socket server instance
     * @param {number} monitorID ID of monitor to send
     * @param {number} userID ID of user to send to
     */
    static async sendUptime(duration, io, monitorID, userID) {
        const uptime = await this.calcUptime(duration, monitorID);
        io.to(userID).emit("uptime", monitorID, duration, uptime);
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
     * @param {Monitor} monitor The monitor to send a notificaton about
     * @param {Bean} bean Status information about monitor
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
                    // Prevent if the msg is undefined, notifications such as Discord cannot send out.
                    const heartbeatJSON = bean.toJSON();
                    if (!heartbeatJSON["msg"]) {
                        heartbeatJSON["msg"] = "N/A";
                    }

                    await Notification.send(JSON.parse(notification.config), msg, await monitor.toJSON(false), heartbeatJSON);
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
     * @returns {Promise<LooseObject<any>[]>}
     */
    static async getNotificationList(monitor) {
        let notificationList = await R.getAll("SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id ", [
            monitor.id,
        ]);
        return notificationList;
    }

    /**
     * Send notification about a certificate
     * @param {Object} tlsInfoObject Information about certificate
     */
    async sendCertNotification(tlsInfoObject) {
        if (tlsInfoObject && tlsInfoObject.certInfo && tlsInfoObject.certInfo.daysRemaining) {
            const notificationList = await Monitor.getNotificationList(this);

            let notifyDays = await setting("tlsExpiryNotifyDays");
            if (notifyDays == null || !Array.isArray(notifyDays)) {
                // Reset Default
                setSetting("tlsExpiryNotifyDays", [ 7, 14, 21 ], "general");
                notifyDays = [ 7, 14, 21 ];
            }

            if (notifyDays != null && Array.isArray(notifyDays)) {
                for (const day of notifyDays) {
                    log.debug("monitor", "call sendCertNotificationByTargetDays", day);
                    await this.sendCertNotificationByTargetDays(tlsInfoObject.certInfo.daysRemaining, day, notificationList);
                }
            }
        }
    }

    /**
     * Send a certificate notification when certificate expires in less
     * than target days
     * @param {number} daysRemaining Number of days remaining on certifcate
     * @param {number} targetDays Number of days to alert after
     * @param {LooseObject<any>[]} notificationList List of notification providers
     * @returns {Promise<void>}
     */
    async sendCertNotificationByTargetDays(daysRemaining, targetDays, notificationList) {

        if (daysRemaining > targetDays) {
            log.debug("monitor", `No need to send cert notification. ${daysRemaining} > ${targetDays}`);
            return;
        }

        if (notificationList.length > 0) {

            let row = await R.getRow("SELECT * FROM notification_sent_history WHERE type = ? AND monitor_id = ? AND days = ?", [
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
                    await Notification.send(JSON.parse(notification.config), `[${this.name}][${this.url}] Certificate will be expired in ${daysRemaining} days`);
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
        } else {
            log.debug("monitor", "No notification, no need to send cert notification");
        }
    }

    /**
     * Get the status of the previous heartbeat
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<LooseObject<any>>}
     */
    static async getPreviousHeartbeat(monitorID) {
        return await R.getRow(`
            SELECT status, time FROM heartbeat
            WHERE id = (select MAX(id) from heartbeat where monitor_id = ?)
        `, [
            monitorID
        ]);
    }

    /**
     * Check if monitor is under maintenance
     * @param {number} monitorID ID of monitor to check
     * @returns {Promise<boolean>}
     */
    static async isUnderMaintenance(monitorID) {
        let activeCondition = Maintenance.getActiveMaintenanceSQLCondition();
        const maintenance = await R.getRow(`
            SELECT COUNT(*) AS count
            FROM monitor_maintenance mm
            JOIN maintenance
                ON mm.maintenance_id = maintenance.id
                AND mm.monitor_id = ?
            LEFT JOIN maintenance_timeslot
                ON maintenance_timeslot.maintenance_id = maintenance.id
            WHERE ${activeCondition}
            LIMIT 1`, [ monitorID ]);
        return maintenance.count !== 0;
    }

    validate() {
        if (this.interval > MAX_INTERVAL_SECOND) {
            throw new Error(`Interval cannot be more than ${MAX_INTERVAL_SECOND} seconds`);
        }
        if (this.interval < MIN_INTERVAL_SECOND) {
            throw new Error(`Interval cannot be less than ${MIN_INTERVAL_SECOND} seconds`);
        }
    }
}

module.exports = Monitor;
