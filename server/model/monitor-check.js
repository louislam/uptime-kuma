const { BeanModel } = require("redbean-node/dist/bean-model");

class MonitorCheck extends BeanModel {
    /**
     * Return a object that ready to parse to JSON
     */
    async toJSON() {
        return {
            id: this.id,
            type: this.type,
            value: this.value,
        };
    }
}

module.exports = MonitorCheck;
