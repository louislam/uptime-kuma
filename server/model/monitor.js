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
        const beat = async () => {
            console.log(`Monitor ${this.id}: Heartbeat`)

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

            io.to(this.user_id).emit("heartbeat", {
                monitorID: this.id,
                status: bean.status,
                time: bean.time,
                msg: bean.msg,
                ping: bean.ping,
            });

            await R.store(bean)
        }

        beat();
        this.heartbeatInterval = setInterval(beat, this.interval * 1000);
    }

    stop() {
        clearInterval(this.heartbeatInterval)
    }
}

module.exports = Monitor;
