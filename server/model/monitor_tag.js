const { BeanModel } = require("redbean-node/dist/bean-model");

class MonitorTag extends BeanModel {

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            monitorId: this._monitorId,
            tagId: this._tagId,
            name: this._value,
        };
    }
}

module.exports = MonitorTag;
