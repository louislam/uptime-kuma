
const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
const axios = require("axios");
const {tcping} = require("../util-server");
const {R} = require("redbean-node");
const {BeanModel} = require("redbean-node/dist/bean-model");


/**
 * status:
 *      0 = DOWN
 *      1 = UP
 */
class Monitor extends BeanModel {

    toJSON() {
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
        };
    }

    start(io) {
        let previousBeat = null;

        const beat = async () => {
            console.log(`Monitor ${this.id}: Heartbeat`)

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
                console.log(previousBeat)
            }

            try {
                if (this.type === "http") {
                    let startTime = dayjs().valueOf();
                    let res = await axios.get(this.url)
                    bean.msg = `${res.status} - ${res.statusText}`
                    bean.ping = dayjs().valueOf() - startTime;
                    bean.status = 1;

                } else if (this.type === "port") {
                    bean.ping = await tcping(this.hostname, this.port);
                    bean.status = 1;
                }

            } catch (error) {
                bean.msg = error.message;
            }

            // Mark as important if status changed
            if (! previousBeat || previousBeat.status !== bean.status) {
                bean.important = true;
            } else {
                bean.important = false;
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

    static async sendStats(io, monitorID, userID) {
        Monitor.sendAvgPing(24, io, monitorID, userID);
        Monitor.sendUptime(24, io, monitorID, userID);
        Monitor.sendUptime(24 * 30, io, monitorID, userID);
    }

    /**
     *
     * @param duration : int Hours
     */
    static async sendAvgPing(duration, io, monitorID, userID) {
        let avgPing = parseInt(await R.getCell(`
            SELECT AVG(ping)
            FROM heartbeat
            WHERE time > DATE('now', ? || ' hours')
            AND ping IS NOT NULL
            AND monitor_id = ? `, [
            -duration,
            monitorID
        ]));

        io.to(userID).emit("avgPing", monitorID, avgPing);
    }

    /**
     *
     * @param duration : int Hours
     */
    static async sendUptime(duration, io, monitorID, userID) {
        let downtime = parseInt(await R.getCell(`
            SELECT SUM(duration)
            FROM heartbeat
            WHERE time > DATE('now', ? || ' hours')
            AND status = 0
            AND monitor_id = ? `, [
            -duration,
            monitorID
        ]));

        let sec = duration * 3600;
        let uptime = (sec - downtime) / sec;

        io.to(userID).emit("uptime", monitorID, duration, uptime);
    }
}

module.exports = Monitor;
