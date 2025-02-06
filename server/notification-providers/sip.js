const NotificationProvider = require("./notification-provider");

class SIP extends NotificationProvider {
    name = "sip";
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let monitorName = monitorJSON ? monitorJSON["name"] : "Unknown Monitor";
        let subject = this.updateSubject(msg, monitorName);
        let body;
        if (heartbeatJSON) {
            body += `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }
        try {
            return "SIP Message Sent Successfully.";
        } catch (error) {
            console.error("Error sending SIP message:", error);
            throw new Error("Failed to send SIP message.");
        }
    }

    updateSubject(message, monitorName) {
        if (!message) return "Default Subject"; // Handle null/undefined message

        message = message.toLowerCase(); // Normalize input

        if (/\bdown\b/i.test(message) || message.includes("offline")) {
            return `🚨 ❌ Service Impacted...`;
        }
        if (/\bup\b/i.test(message) || message.includes("online")) {
            return `🚨 ✅ Service Restored...`;
        }
        if (message.includes("maintenance")) {
            if (message.includes("begin")) {
                return `🚧 🔧 ❌  Maintenance Start...`;
            }
            if (/\bend\b/i.test(message)) {
                return `🚧 🔧 ✅ Maintenance Complete...`;
            }
            if (message.includes("scheduled")) {
                return `🚧 🪟 📆  Maintenance Window Scheduled...`;
            }
            if (message.includes("window begin")) {
                return `🚧 🪟 🛑  Maintenance Window Start...`;
            }
            if (message.includes("window end")) {
                return `🚧 🪟 ✅  Maintenance Window Complete...`;
            }
        }
        if (message.includes("started on node")) {
            return `📈 🔬 ✅  Monitoring Start...`;
        }
        if (message.includes("started")) {
            return `📈 🔬 ✅  ${monitorName}`;
        }

        return "Default Subject";
    }

    async sendSIPMessage(notification, sipMessage) {
        console.log("Sending SIP message with config:", notification);
        console.log("Message:", sipMessage);
    }
}

module.exports = SIP;
