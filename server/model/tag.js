const { BeanModel } = require("redbean-node/dist/bean-model");

class Tag extends BeanModel {
    toJSON() {
        return {
            id: this._id,
            name: this._name,
            color: this._color,
        };
    }
}

module.exports = Tag;
