const { BeanModel } = require("redbean-node/dist/bean-model");

class Incident extends BeanModel {

    toPublicJSON() {
        return {
            id: this.id,
            style: this.style,
            title: this.title,
            content: this.content,
            pin: this.pin,
            createdDate: this.createdDate,
            lastUpdatedDate: this.lastUpdatedDate,
        };
    }
}

module.exports = Incident;
