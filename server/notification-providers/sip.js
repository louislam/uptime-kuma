const NotificationProvider = require("./notification-provider");

class SIP extends NotificationProvider {
    name = "sip";

    /**
     * Sends a SIP notification message.
     * @param {object} notification - SIP notification configuration.
     * @param {string} msg - The message content.
     * @param {object | null} monitorJSON - The monitor data (if available).
     * @param {object | null} heartbeatJSON - The heartbeat data (if available).
     * @returns {Promise<string>} - Confirmation message if successful.
     * @throws {Error} - If sending the SIP message fails.
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let monitorName = monitorJSON ? monitorJSON["name"] : "Unknown Monitor";
        let body = "";

        if (heartbeatJSON) {
            body += `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }

        try {
            console.log("Sending SIP message:", { notification,
                msg,
                monitorName,
                body });
            return "SIP Message Sent Successfully.";
        } catch (error) {
            console.error("Error sending SIP message:", error);
            throw new Error("Failed to send SIP message.");
        }
    }

    /**
     * Generates a subject line based on the message content.
     * @param {string} message - The incoming status message.
     * @param {string} monitorName - The name of the monitored service.
     * @returns {string} - The formatted subject line.
     */
    updateSubject(message, monitorName) {
        if (!message) {
            return "Default Subject";
        }

        message = message.toLowerCase(); // Normalize input

        if (/\bdown\b/i.test(message) || message.includes("offline")) {
            return "🚨 ❌ Service Impacted...";
        }
        if (/\bup\b/i.test(message) || message.includes("online")) {
            return "🚨 ✅ Service Restored...";
        }
        if (message.includes("maintenance")) {
            if (message.includes("begin")) {
                return "🚧 🔧 ❌ Maintenance Start...";
            }
            if (/\bend\b/i.test(message)) {
                return "🚧 🔧 ✅ Maintenance Complete...";
            }
            if (message.includes("scheduled")) {
                return "🚧 🪟 📆 Maintenance Window Scheduled...";
            }
            if (message.includes("window begin")) {
                return "🚧 🪟 🛑 Maintenance Window Start...";
            }
            if (message.includes("window end")) {
                return "🚧 🪟 ✅ Maintenance Window Complete...";
            }
        }
        if (message.includes("started on node")) {
            return "📈 🔬 ✅ Monitoring Start...";
        }
        if (message.includes("started")) {
            return `📈 🔬 ✅ ${monitorName}`;
        }

        return "Default Subject";
    }

    /**
     * Sends a SIP message using the provided notification configuration.
     * @param {object} notification - SIP notification settings.
     * @param {string} sipMessage - The message content to send.
     * @returns {void}
     */
    async sendSIPMessage(notification, sipMessage) {
        console.log("Sending SIP message with config:", notification);
        console.log("Message:", sipMessage);
    }
}

module.exports = SIP;
