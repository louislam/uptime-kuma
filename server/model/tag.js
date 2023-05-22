const { BeanModel } = require("redbean-node/dist/bean-model");

class Tag extends BeanModel {

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            id: this._id,
            name: this._name,
            color: this._color,
        };
    }
}

module.exports = Tag;
