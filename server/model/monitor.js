
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
const axios = require("axios");
const {tcping, ping, checkCertificate} = require("../util-server");
const {R} = require("redbean-node");
const {BeanModel} = require("redbean-node/dist/bean-model");
const {Notification} = require("../notification")

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 */
class Monitor extends BeanModel {

    async toJSON() {

        let notificationIDList = {};

        let list = await R.find("monitor_notification", " monitor_id = ? ", [
            this.id
        ])

        for (let bean of list) {
            notificationIDList[bean.notification_id] = true;
        }

        return {
            id: this.id,
            name: this.name,
            url: this.url,
            hostname: this.hostname,
            port: this.port,
            weight: this.weight,
            active: this.active,
            type: this.type,
            interval: this.interval,
            keyword: this.keyword,
            notificationIDList
        };
    }

    start(io) {
        let previousBeat = null;

        const beat = async () => {
            if (! previousBeat) {
                previousBeat = await R.findOne("heartbeat", " monitor_id = ? ORDER BY time DESC", [
                    this.id
                ])
            }

            let bean = R.dispense("heartbeat")
            bean.monitor_id = this.id;
            bean.time = R.isoDateTime(dayjs.utc());
            bean.status = 0;

            // Duration
            if (previousBeat) {
                bean.duration = dayjs(bean.time).diff(dayjs(previousBeat.time), 'second');
            } else {
                bean.duration = 0;
            }

            try {
                if (this.type === "http" || this.type === "keyword") {
                    let startTime = dayjs().valueOf();
                    let res = await axios.get(this.url, {
                        headers: { 'User-Agent':'Uptime-Kuma' }
                    })
                    bean.msg = `${res.status} - ${res.statusText}`
                    bean.ping = dayjs().valueOf() - startTime;

                    // Check certificate if https is used
                    if (this.getUrl().protocol === "https:") {
                        await this.updateTlsInfo(checkCertificate(res));
                    }

                    if (this.type === "http") {
                        bean.status = 1;
                    } else {

                        let data = res.data;

                        // Convert to string for object/array
                        if (typeof data !== "string") {
                            data = JSON.stringify(data)
                        }

                        if (data.includes(this.keyword)) {
                            bean.msg += ", keyword is found"
                            bean.status = 1;
                        } else {
                            throw new Error(bean.msg + ", but keyword is not found")
                        }

                    }


                } else if (this.type === "port") {
                    bean.ping = await tcping(this.hostname, this.port);
                    bean.msg = ""
                    bean.status = 1;

                } else if (this.type === "ping") {
                    bean.ping = await ping(this.hostname);
                    bean.msg = ""
                    bean.status = 1;
                }

            } catch (error) {
                bean.msg = error.message;
            }

            // Mark as important if status changed
            if (! previousBeat || previousBeat.status !== bean.status) {
                bean.important = true;

                // Do not send if first beat is UP
                if (previousBeat || bean.status !== 1) {
                    let notificationList = await R.getAll(`SELECT notification.* FROM notification, monitor_notification WHERE monitor_id = ? AND monitor_notification.notification_id = notification.id `, [
                        this.id
                    ])

                    let text;
                    if (bean.status === 1) {
                        text = "✅ Up"
                    } else {
                        text = "🔴 Down"
                    }

                    let msg = `[${this.name}] [${text}] ${bean.msg}`;

                    for(let notification of notificationList) {
                        try {
                            await Notification.send(JSON.parse(notification.config), msg, await this.toJSON(), bean.toJSON())
                        } catch (e) {
                            console.error("Cannot send notification to " + notification.name)
                        }
                    }
                }

            } else {
                bean.important = false;
            }

            if (bean.status === 1) {
                console.info(`Monitor #${this.id} '${this.name}': Successful Response: ${bean.ping} ms | Interval: ${this.interval} seconds | Type: ${this.type}`)
            } else {
                console.warn(`Monitor #${this.id} '${this.name}': Failing: ${bean.msg} | Type: ${this.type}`)
            }

            io.to(this.user_id).emit("heartbeat", bean.toJSON());

            await R.store(bean)
            Monitor.sendStats(io, this.id, this.user_id)

            previousBeat = bean;
        }

        beat();
        this.heartbeatInterval = setInterval(beat, this.interval * 1000);
    }

    stop() {
        clearInterval(this.heartbeatInterval)
    }

    // Helper Method: 
    // returns URL object for further usage
    // returns null if url is invalid
    getUrl() {
        try {
            return new URL(this.url);
        } catch (_) {
            return null;
        }
    }

    // Store TLS info to database
    async updateTlsInfo(checkCertificateResult) {
        let tls_info_bean = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            this.id
        ]);
        if (tls_info_bean == null) {
            tls_info_bean = R.dispense("monitor_tls_info");
            tls_info_bean.monitor_id = this.id;
        }
        tls_info_bean.info_json = JSON.stringify(checkCertificateResult);
        R.store(tls_info_bean);
    }

    static async sendStats(io, monitorID, userID) {
        Monitor.sendAvgPing(24, io, monitorID, userID);
        Monitor.sendUptime(24, io, monitorID, userID);
        Monitor.sendUptime(24 * 30, io, monitorID, userID);
        Monitor.sendCertInfo(io, monitorID, userID);
    }

    /**
     *
     * @param duration : int Hours
     */
    static async sendAvgPing(duration, io, monitorID, userID) {
        let avgPing = parseInt(await R.getCell(`
            SELECT AVG(ping)
            FROM heartbeat
            WHERE time > DATETIME('now', ? || ' hours')
            AND ping IS NOT NULL
            AND monitor_id = ? `, [
            -duration,
            monitorID
        ]));

        io.to(userID).emit("avgPing", monitorID, avgPing);
    }

    static async sendCertInfo(io, monitorID, userID) {
         let tls_info = await R.findOne("monitor_tls_info", "monitor_id = ?", [
            monitorID
        ]);
        if (tls_info != null) {
            io.to(userID).emit("certInfo", monitorID, tls_info.info_json);
        }
    }

    /**
     * Uptime with calculation
     * Calculation based on:
     * https://www.uptrends.com/support/kb/reporting/calculation-of-uptime-and-downtime
     * @param duration : int Hours
     */
    static async sendUptime(duration, io, monitorID, userID) {
        let sec = duration * 3600;

        let heartbeatList = await R.getAll(`
            SELECT duration, time, status
            FROM heartbeat
            WHERE time > DATETIME('now', ? || ' hours')
            AND monitor_id = ? `, [
            -duration,
            monitorID
        ]);

        let downtime = 0;
        let total = 0;
        let uptime;

        // Special handle for the first heartbeat only
        if (heartbeatList.length === 1) {

            if (heartbeatList[0].status === 1) {
                uptime = 1;
            } else {
                uptime = 0;
            }

        } else {
            for (let row of heartbeatList) {
                let value = parseInt(row.duration)
                let time = row.time

                // Handle if heartbeat duration longer than the target duration
                // e.g.   Heartbeat duration = 28hrs, but target duration = 24hrs
                if (value > sec) {
                    let trim = dayjs.utc().diff(dayjs(time), 'second');
                    value = sec - trim;

                    if (value < 0) {
                        value = 0;
                    }
                }

                total += value;
                if (row.status === 0) {
                    downtime += value;
                }
            }

            uptime = (total - downtime) / total;

            if (uptime < 0) {
                uptime = 0;
            }
        }



        io.to(userID).emit("uptime", monitorID, duration, uptime);
    }
}

module.exports = Monitor;
