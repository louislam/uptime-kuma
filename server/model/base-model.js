const { Model } = require("objection");

/**
 * Base class for every Uptime Kuma model.
 *
 * Models read and write snake_case columns directly: a Monitor has
 * `bean.user_id`, not `bean.userId`. Code at the API boundary
 * (socket handlers, JSON output) translates between camelCase
 * (frontend convention) and snake_case (DB column) explicitly.
 */
class BaseModel extends Model {
    /**
     * Primary key column name shared by every Uptime Kuma table.
     * @returns {string} Column name
     */
    static get idColumn() {
        return "id";
    }
}

module.exports = { BaseModel };
