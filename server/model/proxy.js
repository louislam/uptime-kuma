const { BeanModel } = require("redbean-node/dist/bean-model");

class Proxy extends BeanModel {
    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        const proxy = this.export();
        proxy.auth = Boolean(proxy.auth);
        proxy.active = Boolean(proxy.active);
        proxy.default = Boolean(proxy.default);
        return proxy;
    }
}

module.exports = Proxy;
