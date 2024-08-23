const { BeanModel } = require("redbean-node/dist/bean-model");

class Incident extends BeanModel {

    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {Object}
     */
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
