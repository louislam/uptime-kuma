const { BeanModel } = require("redbean-node/dist/bean-model");

class DockerHost extends BeanModel {
    /**
     * Returns an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            userId: this._user_id,
            daemon: this._dockerDaemon,
            type: this._dockerType,
            name: this._name,
        };
    }
}

module.exports = DockerHost;
