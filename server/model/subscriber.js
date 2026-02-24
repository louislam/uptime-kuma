const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { nanoid } = require("nanoid");

/**
 * StatusPageSubscriber model
 * Represents email subscribers to status pages
 */
class StatusPageSubscriber extends BeanModel {
    /**
     * Generate unsubscribe token
     * @returns {string} Unsubscribe token
     */
    static generateUnsubscribeToken() {
        return nanoid(32);
    }

    /**
     * Return an object that ready to parse to JSON for admin
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            email: this.email,
            createdAt: this.created_at,
        };
    }

    /**
     * Return an object that ready to parse to JSON for public
     * @returns {object} Object ready to parse
     */
    toPublicJSON() {
        return {
            id: this.id,
            email: this.email,
        };
    }

    /**
     * Find status_page_subscriber by email
     * @param {string} email Email address
     * @returns {Promise<StatusPageSubscriber|null>} StatusPageSubscriber or null
     */
    static async findByEmail(email) {
        return await R.findOne("status_page_subscriber", " email = ? ", [email]);
    }

    /**
     * Find status_page_subscriber by unsubscribe token
     * @param {string} token Unsubscribe token
     * @returns {Promise<StatusPageSubscriber|null>} StatusPageSubscriber or null
     */
    static async findByUnsubscribeToken(token) {
        return await R.findOne("status_page_subscriber", " unsubscribe_token = ? ", [token]);
    }
}

module.exports = StatusPageSubscriber;
