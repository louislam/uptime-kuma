const dayjs = require("dayjs");
const utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone')
dayjs.extend(utc)
dayjs.extend(timezone)
const axios = require("axios");
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
            upRate: this.upRate,
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

            try {
                if (this.type === "http") {
                    let startTime = dayjs().valueOf();
                    let res = await axios.get(this.url)
                    bean.msg = `${res.status} - ${res.statusText}`
                    bean.ping = dayjs().valueOf() - startTime;
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

            Monitor.sendStats(io, this.id, this.user_id)

            await R.store(bean)

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
        //Monitor.sendUptime(24, io, this.id);
        //Monitor.sendUptime(24 * 30, io, this.id);
    }

    static async sendAvgPing(duration, io, monitorID, userID) {
        let avgPing = parseInt(await R.getCell(`
            SELECT AVG(ping)
            FROM heartbeat
            WHERE time > DATE('now', ? || ' hours')
            AND monitor_id = ? `, [
            -duration,
            monitorID
        ]));

        io.to(userID).emit("avgPing", monitorID, avgPing);
    }

    sendUptime(duration) {

    }
}

module.exports = Monitor;
