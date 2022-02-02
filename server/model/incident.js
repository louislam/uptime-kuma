const { BeanModel } = require("redbean-node/dist/bean-model");

class Incident extends BeanModel {

    toPublicJSON() {
        return {
            id: this.id,
            style: this.style,
            title: this.title,
            description: this.description,
            overrideStatus: this.overrideStatus,
            status: this.status,
            createdDate: this.createdDate,
            resolved: this.resolved,
            resolvedDate: this.resolvedDate,
        };
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            style: this.style,
            title: this.title,
            description: this.description,
            overrideStatus: this.overrideStatus,
            status: this.status,
            createdDate: this.createdDate,
            parentIncident: this.parentIncident,
            resolved: this.resolved,
            resolvedDate: this.resolvedDate,
        };
    }
}

module.exports = Incident;
