const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Threema extends NotificationProvider {
    name = "threema";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const url = "https://msgapi.threema.ch/send_simple";

        const config = {
            headers: {
                "Accept": "*/*",
                "Content-Type": "application/x-www-form-urlencoded; charset=utf-8"
            }
        };

        const data = {
            from: notification.threemaSenderIdentity,
            secret: notification.threemaSecret,
            text: msg
        };

        switch (notification.threemaRecipientType) {
            case "identity":
                data.to = notification.threemaRecipient;
                break;
            case "phone":
                data.phone = notification.threemaRecipient;
                break;
            case "email":
                data.email = notification.threemaRecipient;
                break;
            default:
                throw new Error(`Unsupported recipient type: ${notification.threemaRecipientType}`);
        }

        try {
            await axios.post(url, new URLSearchParams(data), config);
            return "Threema notification sent successfully.";
        } catch (error) {
            const errorMessage = this.handleApiError(error);
            this.throwGeneralAxiosError(errorMessage);
        }
    }

    /**
     * Handle Threema API errors
     * @param {any} error The error to handle
     * @returns {string} Additional error context
     */
    handleApiError(error) {
        if (!error.response) {
            return error.message;
        }
        switch (error.response.status) {
            case 400:
                return "Invalid recipient identity or account not set up for basic mode (400).";
            case 401:
                return "Incorrect API identity or secret (401).";
            case 402:
                return "No credits remaining (402).";
            case 404:
                return "Recipient not found (404).";
            case 413:
                return "Message is too long (413).";
            case 500:
                return "Temporary internal server error (500).";
            default:
                return error.message;
        }
    }
}

module.exports = Threema;
