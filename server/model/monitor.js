const https = require("https");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
let timezone = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timezone);
const axios = require("axios");
const { Prometheus } = require("../prometheus");
const { log, UP, DOWN, PENDING, flipStatus, TimeLogger } = require("../../src/util");
const { tcping, ping, dnsResolve, checkCertificate, checkStatusCode, getTotalClientInRoom, setting, mqttAsync } = require("../util-server");
const { R } = require("redbean-node");
const { BeanModel } = require("redbean-node/dist/bean-model");
const { Notification } = require("../notification");
const { Proxy } = require("../proxy");
const { demoMode } = require("../config");
const version = require("../../package.json").version;
const apicache = require("../modules/apicache");
const { UptimeKumaServer } = require("../uptime-kuma-server");

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
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
        };
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
            keyword: this.keyword,
            expiryNotification: this.isEnabledExpiryNotification(),
            ignoreTls: this.getIgnoreTls(),
            upsideDown: this.isUpsideDown(),
            maxredirects: this.maxredirects,
            accepted_statuscodes: this.getAcceptedStatuscodes(),
            dns_resolve_type: this.dns_resolve_type,
            dns_resolve_server: this.dns_resolve_server,
            dns_last_result: this.dns_last_result,
            proxyId: this.proxy_id,
            notificationIDList,
            tags: tags,
            mqttUsername: this.mqttUsername,
            mqttPassword: this.mqttPassword,
            mqttTopic: this.mqttTopic,
            mqttSuccessMessage: this.mqttSuccessMessage
        };

        if (includeSensitiveData) {
            data = {
                ...data,
                headers: this.headers,
                body: this.body,
                basic_auth_user: this.basic_auth_user,
                basic_auth_pass: this.basic_auth_pass,
                pushToken: this.pushToken,
            };
        }

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
            bean.time = R.isoDateTime(dayjs.utc());
            bean.status = DOWN;

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
                if (this.type === "http" || this.type === "keyword") {
                    // Do not do any queries/high loading things before the "bean.ping"
                    let startTime = dayjs().valueOf();

                    // HTTP basic auth
                    let basicAuthHeader = {};
                    if (this.basic_auth_user) {
                        basicAuthHeader = {
                            "Authorization": "Basic " + this.encodeBase64(this.basic_auth_user, this.basic_auth_pass),
                        };
                    }

                    const httpsAgentOptions = {
                        maxCachedSessions: 0, // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                        rejectUnauthorized: !this.getIgnoreTls(),
                    };

                    log.debug("monitor", `[${this.name}] Prepare Options for axios`);

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

                    let res = await axios.request(options);
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
                            throw new Error(bean.msg + ", but keyword is not found");
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

                    let dnsRes = await dnsResolve(this.hostname, this.dns_resolve_server, this.dns_resolve_type);
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
                    const time = R.isoDateTime(dayjs.utc().subtract(this.interval, "second"));

                    let heartbeatCount = await R.count("heartbeat", " monitor_id = ? AND time > ? ", [
                        this.id,
                        time
                    ]);

                    log.debug("monitor", "heartbeatCount" + heartbeatCount + " " + time);

                    if (heartbeatCount <= 0) {
                        throw new Error("No heartbeat in the time window");
                    } else {
                        // No need to insert successful heartbeat for push type, so end here
                        retries = 0;
                        this.heartbeatInterval = setTimeout(beat, beatInterval * 1000);
                        return;
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
                        httpsAgent: new https.Agent({
                            maxCachedSessions: 0,      // Use Custom agent to disable session reuse (https://github.com/nodejs/node/issues/3940)
                            rejectUnauthorized: !this.getIgnoreTls(),
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
                } else if (this.type === "mqtt") {
                    bean.msg = await mqttAsync(this.hostname, this.mqttTopic, this.mqttSuccessMessage, {
                        port: this.port,
                        username: this.mqttUsername,
                        password: this.mqttPassword,
                        interval: this.interval,
                    });
                    bean.status = UP;
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

                log.debug("monitor", `[${this.name}] sendNotification`);
                await Monitor.sendNotification(isFirstBeat, this, bean);

                // Clear Status Page Cache
                log.debug("monitor", `[${this.name}] apicache clear`);
                apicache.clear();

            } else {
                bean.important = false;
            }

            if (bean.status === UP) {
                log.info("monitor", `Monitor #${this.id} '${this.name}': Successful Response: ${bean.ping} ms | Interval: ${beatInterval} seconds | Type: ${this.type}`);
            } else if (bean.status === PENDING) {
                if (this.retryInterval > 0) {
                    beatInterval = this.retryInterval;
                }
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Pending: ${bean.msg} | Max retries: ${this.maxretries} | Retry: ${retries} | Retry Interval: ${beatInterval} seconds | Type: ${this.type}`);
            } else {
                log.warn("monitor", `Monitor #${this.id} '${this.name}': Failing: ${bean.msg} | Interval: ${beatInterval} seconds | Type: ${this.type}`);
            }

            log.debug("monitor", `[${this.name}] Send to socket`);
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
    static async calcUptime(duration, monitorID) {
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
                        WHEN (status = 1)
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
        let isImportant = isFirstBeat ||
            (previousBeatStatus === UP && currentBeatStatus === DOWN) ||
            (previousBeatStatus === DOWN && currentBeatStatus === UP) ||
            (previousBeatStatus === PENDING && currentBeatStatus === DOWN);
        return isImportant;
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
                    await Notification.send(JSON.parse(notification.config), msg, await monitor.toJSON(false), bean.toJSON());
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

            log.debug("monitor", "call sendCertNotificationByTargetDays");
            await this.sendCertNotificationByTargetDays(tlsInfoObject.certInfo.daysRemaining, 21, notificationList);
            await this.sendCertNotificationByTargetDays(tlsInfoObject.certInfo.daysRemaining, 14, notificationList);
            await this.sendCertNotificationByTargetDays(tlsInfoObject.certInfo.daysRemaining, 7, notificationList);
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
}

module.exports = Monitor;
