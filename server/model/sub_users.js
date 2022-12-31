const { BeanModel } = require("redbean-node/dist/bean-model");

class SubUsers extends BeanModel {

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    async toJSON() {
        return {
            id: this.id,
            username: this.username,
        };
    }
}

module.exports = SubUsers;
