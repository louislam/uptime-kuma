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
            this.handleApiError(error);
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Handle Threema API errors
     * @param {any} error The error to handle
     * @returns {void}
     */
    handleApiError(error) {
        if (error.response) {
            const status = error.response.status;
            switch (status) {
                case 400:
                    error.message = "Invalid recipient identity or account not set up for basic mode (400).";
                    break;
                case 401:
                    error.message = "Incorrect API identity or secret (401).";
                    break;
                case 402:
                    error.message = "No credits remaining (402).";
                    break;
                case 404:
                    error.message = "Recipient not found (404).";
                    break;
                case 413:
                    error.message = "Message is too long (413).";
                    break;
                case 500:
                    error.message = "Temporary internal server error (500).";
                    break;
                default:
                    break;
            }
        }
    }
}

module.exports = Threema;
