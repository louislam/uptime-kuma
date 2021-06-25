const dayjs = require("dayjs");
const {BeanModel} = require("redbean-node/dist/bean-model");

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
        const beat = () => {
            console.log(`Monitor ${this.id}: Heartbeat`)
            io.to(this.user_id).emit("heartbeat", dayjs().unix());
        }

        beat();
        this.heartbeatInterval = setInterval(beat, this.interval * 1000);
    }

    stop() {
        clearInterval(this.heartbeatInterval)
    }
}

module.exports = Monitor;
