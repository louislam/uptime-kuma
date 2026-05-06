const { BaseModel } = require("./base-model");

class RemoteBrowser extends BaseModel {
    static tableName = "remote_browser";

    /**
     * Returns an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            url: this.url,
            name: this.name,
        };
    }
}

module.exports = RemoteBrowser;
