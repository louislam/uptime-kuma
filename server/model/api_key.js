const { BaseModel } = require("./base-model");
const dayjs = require("dayjs");

class APIKey extends BaseModel {
    static tableName = "api_key";

    /**
     * Get the current status of this API key
     * @returns {string} active, inactive or expired
     */
    getStatus() {
        let current = dayjs();
        let expiry = dayjs(this.expires);
        if (expiry.diff(current) < 0) {
            return "expired";
        }

        return this.active ? "active" : "inactive";
    }

    /**
     * Returns an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            key: this.key,
            name: this.name,
            userID: this.user_id,
            createdDate: this.created_date,
            active: this.active,
            expires: this.expires,
            status: this.getStatus(),
        };
    }

    /**
     * Returns an object that ready to parse to JSON with sensitive fields
     * removed
     * @returns {object} Object ready to parse
     */
    toPublicJSON() {
        return {
            id: this.id,
            name: this.name,
            userID: this.user_id,
            createdDate: this.created_date,
            active: this.active,
            expires: this.expires,
            status: this.getStatus(),
        };
    }

    /**
     * Create a new API Key and store it in the database
     * @param {object} key Object sent by client
     * @param {int} userID ID of socket user
     * @returns {Promise<bean>} API key
     */
    static async save(key, userID) {
        return APIKey.query().insertAndFetch({
            key: key.key,
            name: key.name,
            user_id: userID,
            active: key.active,
            expires: key.expires,
        });
    }
}

module.exports = APIKey;
