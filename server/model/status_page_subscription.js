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
            groupId: this.group_id,
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
     * @param {number|null} groupId Group ID (optional)
     * @returns {Promise<StatusPageSubscription[]>} Array of subscriptions
     */
    static async getByStatusPage(statusPageId, groupId = null) {
        if (groupId) {
            return await R.find("status_page_subscription", " status_page_id = ? AND (group_id = ? OR group_id IS NULL) ", [
                statusPageId,
                groupId,
            ]);
        }
        return await R.find("status_page_subscription", " status_page_id = ? ", [statusPageId]);
    }

    /**
     * Check if status_page_subscription exists
     * @param {number} subscriberId Subscriber ID
     * @param {number} statusPageId Status Page ID
     * @param {number|null} groupId Group ID (optional)
     * @returns {Promise<StatusPageSubscription|null>} StatusPageSubscription or null
     */
    static async exists(subscriberId, statusPageId, groupId = null) {
        if (groupId) {
            return await R.findOne("status_page_subscription", " subscriber_id = ? AND status_page_id = ? AND group_id = ? ", [
                subscriberId,
                statusPageId,
                groupId,
            ]);
        }
        return await R.findOne("status_page_subscription", " subscriber_id = ? AND status_page_id = ? AND group_id IS NULL ", [
            subscriberId,
            statusPageId,
        ]);
    }
}

module.exports = StatusPageSubscription;
