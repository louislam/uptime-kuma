const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const { nanoid } = require("nanoid");

/**
 * StatusPageSubscription model
 * Links subscribers to status pages and components
 */
class StatusPageSubscription extends BeanModel {
    /**
     * Generate verification token
     * @returns {string} Verification token
     */
    static generateVerificationToken() {
        return nanoid(32);
    }

    /**
     * Verify the status_page_subscription
     * @returns {Promise<void>}
     */
    async verify() {
        this.verified = true;
        this.verification_token = null;
        await R.store(this);
    }

    /**
     * Find status_page_subscription by verification token
     * @param {string} token Verification token
     * @returns {Promise<StatusPageSubscription|null>} StatusPageSubscription or null
     */
    static async findByVerificationToken(token) {
        return await R.findOne("status_page_subscription", " verification_token = ? ", [token]);
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            id: this.id,
            subscriberId: this.subscriber_id,
            statusPageId: this.status_page_id,
            componentId: this.component_id,
            notifyIncidents: !!this.notify_incidents,
            notifyMaintenance: !!this.notify_maintenance,
            notifyStatusChanges: !!this.notify_status_changes,
            verified: !!this.verified,
            createdAt: this.created_at,
        };
    }

    /**
     * Get all subscriptions for a subscriber
     * @param {number} subscriberId Subscriber ID
     * @returns {Promise<StatusPageSubscription[]>} Array of subscriptions
     */
    static async getBySubscriber(subscriberId) {
        return await R.find("status_page_subscription", " subscriber_id = ? ", [subscriberId]);
    }

    /**
     * Get all subscriptions for a status page
     * @param {number} statusPageId Status Page ID
     * @param {number|null} componentId Component ID (optional)
     * @returns {Promise<StatusPageSubscription[]>} Array of subscriptions
     */
    static async getByStatusPage(statusPageId, componentId = null) {
        if (componentId) {
            return await R.find("status_page_subscription", " status_page_id = ? AND (component_id = ? OR component_id IS NULL) ", [
                statusPageId,
                componentId,
            ]);
        }
        return await R.find("status_page_subscription", " status_page_id = ? ", [statusPageId]);
    }

    /**
     * Check if status_page_subscription exists
     * @param {number} subscriberId Subscriber ID
     * @param {number} statusPageId Status Page ID
     * @param {number|null} componentId Component ID
     * @returns {Promise<StatusPageSubscription|null>} StatusPageSubscription or null
     */
    static async exists(subscriberId, statusPageId, componentId = null) {
        if (componentId) {
            return await R.findOne("status_page_subscription", " subscriber_id = ? AND status_page_id = ? AND component_id = ? ", [
                subscriberId,
                statusPageId,
                componentId,
            ]);
        }
        return await R.findOne("status_page_subscription", " subscriber_id = ? AND status_page_id = ? AND component_id IS NULL ", [
            subscriberId,
            statusPageId,
        ]);
    }
}

module.exports = StatusPageSubscription;
