const { BeanModel } = require("redbean-node/dist/bean-model");

class Notification extends BeanModel {

    /**
     * Return an object that ready to parse to JSON
     * @returns {Object}
     */
    toJSON() {
        let notification = this.export();
        notification.isDefault = (notification.isDefault === 1);
        notification.active = (notification.active === 1);
        return notification;
    }
}

module.exports = Notification;
