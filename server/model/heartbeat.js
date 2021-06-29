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
class Heartbeat extends BeanModel {

    toJSON() {
        return {
            monitorID: this.monitor_id,
            status: this.status,
            time: this.time,
            msg: this.msg,
            ping: this.ping,
            important: this.important,
        };
    }

}

module.exports = Heartbeat;
