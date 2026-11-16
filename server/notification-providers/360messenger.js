const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Whatsapp360messenger extends NotificationProvider {
    name = "Whatsapp360messenger";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.Whatsapp360messengerAuthToken,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            // Use custom template if enabled
            let message = msg;
            if (notification.Whatsapp360messengerUseTemplate && notification.Whatsapp360messengerTemplate) {
                message = this.applyTemplate(
                    notification.Whatsapp360messengerTemplate,
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );
            }

            // Normalize recipients: support comma/semicolon-separated list
            const recipients = (notification.Whatsapp360messengerRecipient || "")
                .split(/[;,]/)
                .map((r) => r.trim())
                .filter((r) => r !== "");

            // Normalize group IDs: support array (multi-select) and fallback to single value / delimited string
            const rawGroupIds =
                notification.Whatsapp360messengerGroupIds || notification.Whatsapp360messengerGroupId || "";

            let groupIds = [];
            if (Array.isArray(rawGroupIds)) {
                groupIds = rawGroupIds
                    .map((g) => {
                        if (typeof g === "string") {
                            return g.trim();
                        }
                        if (g && typeof g === "object" && g.id) {
                            return String(g.id).trim();
                        }
                        return "";
                    })
                    .filter((g) => g !== "");
            } else if (typeof rawGroupIds === "string" && rawGroupIds.trim() !== "") {
                groupIds = rawGroupIds
                    .split(/[;,]/)
                    .map((g) => g.trim())
                    .filter((g) => g !== "");
            }

            const hasGroupId = groupIds.length > 0;
            const hasRecipient = recipients.length > 0;

            // Send to both if both are provided
            if (hasGroupId && hasRecipient) {
                // Send to all individual recipients
                await Promise.all(
                    recipients.map((recipient) => {
                        const recipientData = {
                            phonenumber: recipient,
                            text: message,
                        };
                        return axios.post("https://api.360messenger.com/v2/sendMessage", recipientData, config);
                    })
                );

                // Send to all selected groups
                await Promise.all(
                    groupIds.map((groupId) => {
                        const groupData = {
                            groupId,
                            text: message,
                        };
                        return axios.post("https://api.360messenger.com/v2/sendGroup", groupData, config);
                    })
                );

                return `${okMsg} (Sent to ${recipients.length} recipient(s) and ${groupIds.length} group(s))`;
            } else if (hasGroupId) {
                // Send to group(s) only
                await Promise.all(
                    groupIds.map((groupId) => {
                        const data = {
                            groupId,
                            text: message,
                        };
                        return axios.post("https://api.360messenger.com/v2/sendGroup", data, config);
                    })
                );

                return `${okMsg} (Sent to ${groupIds.length} group(s))`;
            } else if (hasRecipient) {
                // Send to recipient(s) only
                await Promise.all(
                    recipients.map((recipient) => {
                        const data = {
                            phonenumber: recipient,
                            text: message,
                        };
                        return axios.post("https://api.360messenger.com/v2/sendMessage", data, config);
                    })
                );

                return `${okMsg} (Sent to ${recipients.length} recipient(s))`;
            } else {
                throw new Error("No recipient or group specified");
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Apply template with variables
     * @param {string} template - Template string
     * @param {string} msg - Default message
     * @param {object} monitorJSON - Monitor data
     * @param {object} heartbeatJSON - Heartbeat data
     * @returns {string} Formatted message
     */
    applyTemplate(template, msg, monitorJSON, heartbeatJSON) {
        try {
            // Simple template replacement
            let result = template;

            // Replace monitor variables
            if (monitorJSON) {
                result = result.replace(/{{ monitorJSON\['name'\] }}/g, monitorJSON.name || "");
                result = result.replace(/{{ monitorJSON\['url'\] }}/g, monitorJSON.url || "");
            }

            // Replace message variable
            result = result.replace(/{{ msg }}/g, msg);

            // Handle conditional blocks (simple if statements)
            result = result.replace(/{% if monitorJSON %}([\s\S]*?){% endif %}/g, (match, content) => {
                return monitorJSON ? content : "";
            });

            return result;
        } catch (error) {
            // If template parsing fails, return original message
            return msg;
        }
    }
}

module.exports = Whatsapp360messenger;
