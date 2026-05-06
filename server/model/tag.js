const { BaseModel } = require("./base-model");

class Tag extends BaseModel {
    static tableName = "tag";

    /**
     * Return an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
        };
    }
}

module.exports = Tag;
